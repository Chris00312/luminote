/**
 * LumiNote — Agent Engine
 * Multi-turn tool-calling loop with context injection and guardrails.
 */

import { loadConfig, chatWithTools, PROVIDERS } from './api-providers.js';
import {
  TOOL_DEFS, RISK, getToolRisk, executeTool, extractImages,
  toOpenAITools, toClaudeTools, toGeminiTools,
} from './agent-tools.js';
import { t } from './i18n.js';

/* ─── Constants ────────────────────────────────────────────────── */

/* ─── Token budget for the tool-calling loop ───────────────────── */

const BUDGET = {
  byok:  { maxToolRounds: 10, maxContextChars: 48000, maxImagesPerTurn: 5, maxTokens: 8192 },
};

function getBudget(/* plan */) { return BUDGET.byok; }

// Legacy constants (used as fallback)
const MAX_TOOL_ROUNDS = 10;
const MAX_CONTEXT_CHARS = 48000;
const MAX_IMAGES_PER_TURN = 5;

/* ─── Provider capability matrix ───────────────────────────────── */

const PROVIDER_CAPS = {
  [PROVIDERS.OPENAI_COMPAT]: { toolCalling: true,  vision: true  },
  [PROVIDERS.CLAUDE]:        { toolCalling: true,  vision: true  },
  [PROVIDERS.GEMINI]:        { toolCalling: true,  vision: true  },
  [PROVIDERS.VOLCENGINE]:    { toolCalling: true,  vision: true  },
  [PROVIDERS.MINIMAX]:       { toolCalling: true,  vision: true  },
  [PROVIDERS.ALIYUN]:        { toolCalling: true,  vision: false },
};

export function getProviderCaps(provider) {
  return PROVIDER_CAPS[provider] || { toolCalling: true, vision: false };
}

/* ─── Context builder ──────────────────────────────────────────── */

/**
 * Build the agent's awareness of the current UI state.
 * Called before every agent turn to get fresh context.
 * @param {Function} getContext - provided by notebook.js, returns { view, activeSession, totalMemories }
 * @returns {string}
 */
export function buildContextBlock(ctx) {
  const lines = [];
  lines.push(`Current view: ${ctx.view}`);
  if (ctx.memoryMode) lines.push(`Memory mode: ${ctx.memoryMode}`);
  if (ctx.searchQuery) lines.push(`Active search: "${ctx.searchQuery}"`);
  if (ctx.currentDayKey) lines.push(`Browsing date: ${ctx.currentDayKey}`);
  lines.push(`Total memories: ${ctx.totalMemories}${ctx.todayCount ? ` (${ctx.todayCount} today)` : ''}`);

  if (ctx.view === 'moodboard' && ctx.activeSession) {
    const s = ctx.activeSession;
    const selectedSet = new Set(ctx.selectedCardIds || []);
    lines.push('');
    lines.push(`Active Moodboard: "${s.name}" (id: ${s.id})`);
    lines.push(`Cards on board: ${s.cards.length}`);
    if (selectedSet.size > 0) {
      lines.push(`Selected cards: ${selectedSet.size}`);
    }
    if (s.cards.length > 0) {
      // Show selected cards first with full detail
      if (selectedSet.size > 0) {
        lines.push('');
        lines.push('=== Selected Cards (user is focusing on these) ===');
        for (const c of s.cards) {
          if (!selectedSet.has(c.cardId)) continue;
          const tags = c.tags?.length ? ` [${c.tags.join(', ')}]` : '';
          lines.push(`  - "${c.term}" (id: ${c.entryId})${tags}`);
          if (c.note) lines.push(`    note: ${c.note.slice(0, 500)}`);
        }
      }
      // Then show all cards (brief)
      lines.push('');
      lines.push('All Cards:');
      for (const c of s.cards) {
        const sel = selectedSet.has(c.cardId) ? ' [SELECTED]' : '';
        const tags = c.tags?.length ? ` [${c.tags.join(', ')}]` : '';
        lines.push(`  - "${c.term}" (id: ${c.entryId})${tags}${sel}`);
        if (c.note && !selectedSet.has(c.cardId)) lines.push(`    note: ${c.note.slice(0, 120)}`);
      }
    }
  }

  return lines.join('\n');
}

/* ─── System prompt ────────────────────────────────────────────── */

// Static part — identical across turns, cacheable by Claude (cache_control) and OpenAI (auto prefix cache)
const SYSTEM_PROMPT_STATIC = `You are LumiNote Agent, a research assistant in the LumiNote browser extension. You help users discuss topics, manage their Memory Library, and organize Moodboards.

## Guidelines
- Respond directly to knowledge questions. Only call tools when the user wants to interact with their data (search, save, organize).
- Use markdown (## headings, **bold**, lists) for structured responses.
- When creating memories: "term" = title, "note" = full detailed content body (never abbreviate), "aiSummary" = one-line summary. Set entryType="text", sourceKind="web".
- When adding cards to boards: omit x/y (auto-positioned). Check existing boards with list_moodboard_sessions before creating new ones.
- Confirm before deleting. Never fabricate data.
- For image browsing: search first, only fetch specific ones on demand. Max images/turn is limited by system.
- When selected cards are shown in Current State, focus answers on them.
- After giving a substantive answer (analysis, explanation, summary), briefly suggest a relevant next action if appropriate, e.g. "需要我把这个结论保存到记忆库吗？" or "要添加到灵感板吗？". Do NOT suggest after casual chat like greetings.`;

/**
 * Build system prompt as two-part array for provider-level prompt caching.
 * Part 0 is static (cacheable); Part 1 is dynamic (changes per turn).
 * Providers that support prompt caching (Claude: cache_control, OpenAI: auto prefix)
 * can use this split to cache the static portion.
 */
function buildSystemPrompt(contextBlock, outputLanguage) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

  const dynamicPart = `- Always respond in the user's language. Current output language preference: ${outputLanguage || 'Auto'}.
- Current date and time: ${dateStr} ${timeStr}. Use this to interpret relative dates like "today", "yesterday", "this week", etc.

## Current State
${contextBlock}`;

  return [
    { type: 'text', text: SYSTEM_PROMPT_STATIC, _cacheable: true },
    { type: 'text', text: dynamicPart },
  ];
}

/* ─── Message history conversion for multi-turn ────────────────── */

function toProviderMessages(history, provider) {
  // history is our internal format: [{ role, content, toolCalls?, toolResults? }]
  // We need to convert to the wire format each provider expects.

  const isOpenAI = [PROVIDERS.OPENAI_COMPAT, PROVIDERS.VOLCENGINE, PROVIDERS.ALIYUN].includes(provider);
  const isClaude = [PROVIDERS.CLAUDE, PROVIDERS.MINIMAX].includes(provider);
  const isGemini = provider === PROVIDERS.GEMINI;

  const out = [];

  for (const msg of history) {
    if (msg.role === 'system' || msg.role === 'user') {
      out.push({ role: msg.role, content: msg.content });
      continue;
    }

    if (msg.role === 'assistant') {
      // IMPORTANT: Always reconstruct from toolCalls if present.
      // _raw can become stale or lose fields after serialization.
      if (msg.toolCalls?.length) {
        if (isOpenAI) {
          out.push({
            role: 'assistant',
            content: msg.content || null,
            tool_calls: msg.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: JSON.stringify(tc.args) },
            })),
          });
        } else if (isClaude) {
          const content = [];
          if (msg.content) content.push({ type: 'text', text: msg.content });
          for (const tc of msg.toolCalls) {
            content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.args });
          }
          out.push({ role: 'assistant', content });
        } else if (isGemini) {
          const parts = [];
          if (msg.content) parts.push({ text: msg.content });
          for (const tc of msg.toolCalls) {
            parts.push({ functionCall: { name: tc.name, args: tc.args } });
          }
          out.push({ role: 'model', parts });
        }
      } else {
        out.push({ role: 'assistant', content: msg.content || '' });
      }
      continue;
    }

    if (msg.role === 'tool_result') {
      if (isOpenAI) {
        out.push({
          role: 'tool',
          tool_call_id: msg.toolCallId,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        });
      } else if (isClaude) {
        out.push({
          role: 'tool_result',
          tool_use_id: msg.toolCallId,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        });
      } else if (isGemini) {
        out.push({
          role: 'tool_result',
          functionName: msg.toolName,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        });
      }
    }
  }

  return out;
}

function getToolsForProvider(provider) {
  const isOpenAI = [PROVIDERS.OPENAI_COMPAT, PROVIDERS.VOLCENGINE, PROVIDERS.ALIYUN].includes(provider);
  const isClaude = [PROVIDERS.CLAUDE, PROVIDERS.MINIMAX].includes(provider);
  const isGemini = provider === PROVIDERS.GEMINI;

  if (isOpenAI)  return toOpenAITools();
  if (isClaude)  return toClaudeTools();
  if (isGemini)  return toGeminiTools();
  return toOpenAITools(); // fallback
}

/* ─── Context window management ───────────────────────────────── */

/**
 * Estimate char count of a message (rough ~4 chars/token heuristic).
 */
function msgSize(msg) {
  let size = (msg.content || '').length;
  if (msg.toolCalls) size += JSON.stringify(msg.toolCalls).length;
  if (msg.toolArgs)  size += JSON.stringify(msg.toolArgs).length;
  return size;
}

/**
 * Truncate conversation history to stay within MAX_CONTEXT_CHARS.
 * Strategy: keep the latest user message + as many recent messages as fit.
 * Always preserves the last user message and any trailing tool_result/assistant
 * messages that form a complete tool-call sequence.
 */
function truncateHistory(messages, maxChars = MAX_CONTEXT_CHARS) {
  let total = 0;
  for (const m of messages) total += msgSize(m);

  if (total <= maxChars) return messages;

  const kept = [];
  let budget = maxChars;

  for (let i = messages.length - 1; i >= 0; i--) {
    const size = msgSize(messages[i]);
    if (budget - size < 0 && kept.length >= 2) break;
    budget -= size;
    kept.unshift(messages[i]);
  }

  console.debug(`[AgentEngine] truncated history: ${messages.length} → ${kept.length} messages (${total} → ${total - budget} chars)`);
  return kept;
}

/* ─── Main agent loop ──────────────────────────────────────────── */

/**
 * Run the agent for one user turn.
 * Handles multi-round tool calling internally.
 *
 * @param {Object} opts
 * @param {Array}   opts.messages       - conversation history (internal format)
 * @param {Function} opts.getContext    - () => { view, activeSession, totalMemories }
 * @param {Function} opts.onToolCall   - (toolName, args, risk) => Promise<boolean>  (for HIGH risk: must resolve true to proceed)
 * @param {Function} opts.onToolResult - (toolName, args, result) => void  (for UI receipt rendering)
 * @param {Function} opts.onThinking   - () => void  (show thinking indicator)
 * @param {Function} opts.onText       - (text) => void  (final text chunk)
 * @param {Function} opts.onError      - (errMsg) => void
 * @param {Function} opts.onDone       - (assistantMsg) => void  (full assistant message for history)
 * @param {Function} [opts.onUsage]    - ({ promptTokens, completionTokens, totalTokens }) => void  (token usage per API call)
 */
export async function runAgentTurn({
  messages,
  getContext,
  onToolCall,
  onToolResult,
  onAssistantIntermediate,
  onThinking,
  onText,
  onError,
  onDone,
  onUsage,
}) {
  let config;
  try {
    config = await loadConfig();
  } catch (e) {
    onError(t('agent_error_config') || 'Failed to load AI config');
    return;
  }

  // LumiNote is BYOK-only — no backend proxy, no login required.
  if (!config.apiKey) {
    onError('请先在设置中配置你自己的 AI API Key（Settings → 启用自定义 AI 服务）。');
    return;
  }

  const plan = 'byok';
  const budget = getBudget(plan);
  const allTools = getToolsForProvider(config.provider);

  // Smart tool routing: only inject tools when the latest user message
  // suggests data interaction. Saves ~800-1200 tokens on casual chat.
  const lastUserMsg = messages.filter(m => m.role === 'user').pop();
  const lastText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';
  const needsTools = /搜索|查找|记忆|灵感板|保存|创建|删除|更新|添加|卡片|board|moodboard|search|find|save|create|delete|update|add|remove|memory|memories|note|总结|归纳|整理|分析这|分析一下/i.test(lastText);
  const tools = needsTools ? allTools : [];
  const ctx = getContext();
  const contextBlock = buildContextBlock(ctx);
  const systemPrompt = buildSystemPrompt(contextBlock, config.outputLanguage);

  // Truncate old messages to stay within token budget
  const trimmed = truncateHistory(messages, budget.maxContextChars);

  // Build wire-format messages
  const systemMsg = { role: 'system', content: systemPrompt };
  const wireMessages = [systemMsg, ...toProviderMessages(trimmed, config.provider)];

  let round = 0;
  let imagesInjectedThisTurn = 0;
  const caps = getProviderCaps(config.provider);

  while (round < budget.maxToolRounds) {
    round++;
    onThinking();

    let response;
    try {
      console.debug(`[AgentEngine] round=${round} provider=${config.provider} model=${config.model} msgCount=${wireMessages.length} plan=${plan}`);
      response = await chatWithTools({ messages: wireMessages, tools, config });
      console.debug(`[AgentEngine] response: text=${(response.text || '').length}ch toolCalls=${response.toolCalls?.length || 0} stop=${response.stopReason}`);
    } catch (e) {
      console.error('[AgentEngine] API call failed:', e);

      let errMsg = e.message;
      if (errMsg.includes('404') && errMsg.includes('NotFound')) {
        errMsg += '\n\n' + (t('agent_error_model_not_found') || 'This model may not support tool calling. Try switching to a different model in Settings (e.g. GPT-4o, Claude, Gemini).');
      }
      onError(errMsg);
      return;
    }

    // Emit token usage for this API call
    if (response.usage && onUsage) {
      onUsage(response.usage);
    }

    // If no tool calls — we have the final text response
    if (!response.toolCalls?.length) {
      const text = response.text || '';
      onText(text);
      onDone({
        role: 'assistant',
        content: text,
        _raw: buildAssistantRaw(response, config.provider),
      });
      return;
    }

    // Process tool calls — save intermediate assistant message (with tool_calls)
    const assistantRaw = buildAssistantRaw(response, config.provider);
    wireMessages.push(assistantRaw);

    // Notify chat layer so it can persist the intermediate assistant msg
    // This is critical: on next turn, tool_result messages MUST follow
    // an assistant message with tool_calls, or OpenAI/DeepSeek will reject.
    if (onAssistantIntermediate) {
      onAssistantIntermediate({
        role: 'assistant',
        content: response.text || '',
        toolCalls: response.toolCalls.map((tc) => ({
          id: tc.id, name: tc.name, args: tc.args,
        })),
        _raw: assistantRaw,
      });
    }

    for (const tc of response.toolCalls) {
      const risk = getToolRisk(tc.name);

      // Guardrail: high-risk tools require user confirmation
      if (risk === RISK.HIGH) {
        const approved = await onToolCall(tc.name, tc.args, risk);
        if (!approved) {
          // User declined — inject a refusal as tool result
          const refusalContent = JSON.stringify({ ok: false, error: 'User declined this action' });
          wireMessages.push(buildToolResultWire(tc, refusalContent, config.provider));
          onToolResult(tc.name, tc.args, { ok: false, error: 'Declined by user' }, tc.id);
          continue;
        }
      }

      // Execute the tool
      let result;
      try {
        result = await executeTool(tc.name, tc.args);
      } catch (e) {
        result = { ok: false, error: e.message };
      }

      // Separate images from text result before sending
      const images = result?._images || [];
      if (result?._images) delete result._images;

      const resultStr = JSON.stringify(result);
      wireMessages.push(buildToolResultWire(tc, resultStr, config.provider));

      // Strategy: inject images for vision-capable models, with per-turn cap
      if (images.length && caps.vision) {
        const imgBudget = budget.maxImagesPerTurn - imagesInjectedThisTurn;

        if (imgBudget > 0) {
          const batch = images.slice(0, imgBudget);
          const skipped = images.length - batch.length;

          // Use detail:low when there are many images (batch mode) to save tokens
          const detailLevel = images.length > 2 ? 'low' : 'auto';

          const imgContent = batch.map((img) => ({
            type: 'image',
            mimeType: img.mimeType,
            data: img.data,
            detail: detailLevel,
          }));

          let hint = `[Showing ${batch.length} of ${images.length} image(s) from the tool result above (detail: ${detailLevel}).`;
          if (skipped > 0) {
            hint += ` ${skipped} image(s) omitted due to per-turn limit. Ask the user if they want to see more.`;
          }
          hint += ']';

          imgContent.push({ type: 'text', text: hint });
          wireMessages.push({ role: 'user', content: imgContent });

          imagesInjectedThisTurn += batch.length;
          console.debug(`[AgentEngine] injected ${batch.length}/${images.length} image(s), detail=${detailLevel}, total this turn=${imagesInjectedThisTurn}`);
        } else {
          // Budget exhausted — tell AI images exist but weren't shown
          wireMessages.push({
            role: 'user',
            content: `[This tool result contains ${images.length} image(s) but the per-turn image limit (${budget.maxImagesPerTurn}) has been reached. Describe what you know from the text metadata. Tell the user they can ask to see specific images by title or ID.]`,
          });
          console.debug(`[AgentEngine] image budget exhausted, skipped ${images.length} image(s)`);
        }
      }

      onToolResult(tc.name, tc.args, result, tc.id);
    }

    // Continue the loop — AI will process tool results and may issue more calls or give final text
  }

  // If we've exhausted rounds
  onError(t('agent_error_loop') || 'Agent reached maximum tool call rounds.');
}

/* ─── Wire-format helpers ──────────────────────────────────────── */

function buildAssistantRaw(response, provider) {
  const isOpenAI = [PROVIDERS.OPENAI_COMPAT, PROVIDERS.VOLCENGINE, PROVIDERS.ALIYUN].includes(provider);
  const isClaude = [PROVIDERS.CLAUDE, PROVIDERS.MINIMAX].includes(provider);

  if (isOpenAI) {
    const msg = { role: 'assistant', content: response.text || null };
    if (response.toolCalls?.length) {
      msg.tool_calls = response.toolCalls.map((tc) => tc._raw || {
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.args) },
      });
    }
    return msg;
  }

  if (isClaude) {
    return {
      role: 'assistant',
      _claudeContent: response._claudeContent,
      content: response._claudeContent,
    };
  }

  // Gemini
  return {
    role: 'assistant',
    _geminiParts: response._geminiParts,
    content: response.text || '',
  };
}

function buildToolResultWire(tc, contentStr, provider) {
  const isOpenAI = [PROVIDERS.OPENAI_COMPAT, PROVIDERS.VOLCENGINE, PROVIDERS.ALIYUN].includes(provider);
  const isClaude = [PROVIDERS.CLAUDE, PROVIDERS.MINIMAX].includes(provider);

  if (isOpenAI) {
    return { role: 'tool', tool_call_id: tc.id, content: contentStr };
  }
  if (isClaude) {
    return {
      role: 'tool_result',
      tool_use_id: tc.id,
      content: contentStr,
    };
  }
  // Gemini
  return {
    role: 'tool_result',
    functionName: tc.name,
    content: contentStr,
  };
}
