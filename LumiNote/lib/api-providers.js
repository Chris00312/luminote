/**
 * LumiRead — Multi-API Provider Layer
 * Unified streaming interface for OpenAI-compatible, Claude, and Gemini APIs.
 */

/* ─── Provider registry ────────────────────────────────────────── */

export const PROVIDERS = {
  OPENAI_COMPAT: 'openai_compat',
  CLAUDE: 'claude',
  GEMINI: 'gemini',
  VOLCENGINE: 'volcengine',
  MINIMAX: 'minimax',
  ALIYUN: 'aliyun',
};

/**
 * Load API config from chrome.storage.sync
 * @returns {Promise<{provider, apiKey, endpoint, model, outputLanguage, aiSummaryDepth}>}
 */
export async function loadConfig() {
  const cfg = await new Promise((resolve) => {
    chrome.storage.sync.get(
      {
        provider: PROVIDERS.OPENAI_COMPAT,
        apiKey: '',
        endpoint: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        outputLanguage: 'Chinese',
        aiSummaryDepth: 'brief',
        useCustomAI: false,
        p2provider: '',
        p2apiKey: '',
        p2endpoint: 'https://api.openai.com/v1',
        p2model: '',
        visionProvider: '',
        visionApiKey: '',
        visionEndpoint: 'https://api.openai.com/v1',
        visionModel: '',
      },
      resolve
    );
  });
  return cfg;
}

/**
 * Check if messages contain image content (base64 or image_url).
 * Used to decide whether to route to the vision model config.
 */
function hasImageContent(messages) {
  for (const msg of messages) {
    if (!msg.content) continue;
    if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === 'image_url' || part.type === 'image' || part.type === 'image_source') return true;
        // Gemini-style inlineData
        if (part.inlineData || part.inline_data) return true;
        // Claude-style source block
        if (part.type === 'image' && part.source) return true;
      }
    }
  }
  return false;
}

/**
 * Build a vision-specific config from the full config object.
 * Returns null if vision is not configured (falls back to primary).
 */
export function getVisionConfig(fullConfig) {
  if (!fullConfig.visionProvider || !fullConfig.visionApiKey) return null;
  return {
    provider: fullConfig.visionProvider,
    apiKey: fullConfig.visionApiKey,
    endpoint: fullConfig.visionEndpoint || 'https://api.openai.com/v1',
    model: fullConfig.visionModel || '',
    outputLanguage: fullConfig.outputLanguage,
    aiSummaryDepth: fullConfig.aiSummaryDepth,
  };
}

/**
 * Main entry: stream explanation from configured AI provider.
 * Calls onChunk(text) for each streamed token.
 * Calls onDone() when complete.
 * Calls onError(err) on failure.
 */
export async function streamExplain({ messages, config: configOverride, maxTokens, onChunk, onDone, onError }) {
  let config;
  try {
    config = configOverride || await loadConfig();
  } catch (e) {
    onError('Failed to load config: ' + e.message);
    return;
  }

  // Route to vision model if messages contain images and vision config exists
  if (hasImageContent(messages)) {
    const visionCfg = getVisionConfig(config);
    if (visionCfg) config = visionCfg;
  }

  if (!config.apiKey) {
    onError('API key not configured. Please open LumiNote settings.');
    return;
  }

  const mt = maxTokens || 2048;

  try {
    switch (config.provider) {
      case PROVIDERS.CLAUDE:
        await streamClaude({ config, messages, maxTokens: mt, onChunk, onDone, onError });
        break;
      case PROVIDERS.GEMINI:
        await streamGemini({ config, messages, maxTokens: mt, onChunk, onDone, onError });
        break;
      case PROVIDERS.MINIMAX:
        // MiniMax Token Plan — Anthropic-compatible endpoint
        await streamClaude({
          config: { ...config, _baseUrl: 'https://api.minimaxi.com/anthropic' },
          messages, maxTokens: mt, onChunk, onDone, onError,
        });
        break;
      case PROVIDERS.ALIYUN:
        await streamOpenAICompat({
          config: { ...config, endpoint: 'https://coding.dashscope.aliyuncs.com/v1' },
          messages, maxTokens: mt, onChunk, onDone, onError,
        });
        break;
      case PROVIDERS.VOLCENGINE:
        // Coding Plan — all models support vision; use /api/coding/v3 (OpenAI-compat)
        await streamOpenAICompat({
          config: { ...config, endpoint: 'https://ark.cn-beijing.volces.com/api/coding/v3' },
          messages, maxTokens: mt, onChunk, onDone, onError,
        });
        break;
      case PROVIDERS.OPENAI_COMPAT:
      default:
        await streamOpenAICompat({ config, messages, maxTokens: mt, onChunk, onDone, onError });
        break;
    }
  } catch (e) {
    onError(e.message || String(e));
  }
}

/* ─── OpenAI-Compatible ─────────────────────────────────────────── */

async function streamOpenAICompat({ config, messages, maxTokens, onChunk, onDone, onError }) {
  const endpoint = (config.endpoint || 'https://api.openai.com/v1').replace(/\/$/, '');
  const url = `${endpoint}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4o-mini',
      messages: messages.map((message) => ({
        ...message,
        content: toOpenAIContent(message.content),
      })),
      stream: true,
      temperature: 0.7,
      max_tokens: maxTokens || 2048,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    onError(`API error ${response.status}: ${err}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) onChunk(delta);
      } catch {
        // skip malformed SSE lines
      }
    }
  }
  onDone();
}

/* ─── Anthropic Claude ──────────────────────────────────────────── */

async function streamClaude({ config, messages, maxTokens, onChunk, onDone, onError }) {
  // Separate system message from user/assistant turns
  const systemMsg = messages.find((m) => m.role === 'system');
  const turns = messages.filter((m) => m.role !== 'system');

  // Support custom base URL (e.g. MiniMax Anthropic-compat endpoint)
  const baseUrl = (config._baseUrl || 'https://api.anthropic.com').replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model || 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens || 2048,
      system: toClaudeSystem(systemMsg?.content, !config._baseUrl),
      messages: turns.map((message) => ({
        role: message.role,
        content: toClaudeContent(message.content),
      })),
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    onError(`Claude API error ${response.status}: ${err}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
          onChunk(json.delta.text);
        } else if (json.type === 'message_stop') {
          // stream ended
        }
      } catch {
        // skip
      }
    }
  }
  onDone();
}

/* ─── Google Gemini ─────────────────────────────────────────────── */

async function streamGemini({ config, messages, maxTokens, onChunk, onDone, onError }) {
  const model = config.model || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${config.apiKey}&alt=sse`;

  // Convert messages to Gemini format
  const systemMsg = messages.find((m) => m.role === 'system');
  const turns = messages.filter((m) => m.role !== 'system');

  const contents = turns.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: toGeminiParts(m.content),
  }));

  const body = { contents };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: toPlainText(systemMsg.content) }] };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    onError(`Gemini API error ${response.status}: ${err}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) onChunk(text);
      } catch {
        // skip
      }
    }
  }
  onDone();
}

function toOpenAIContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content || '');

  return content.flatMap((part) => {
    if (part.type === 'text') {
      return [{ type: 'text', text: part.text || '' }];
    }

    if (part.type === 'image' && part.data && part.mimeType) {
      const imgObj = { url: `data:${part.mimeType};base64,${part.data}` };
      if (part.detail) imgObj.detail = part.detail;
      return [{ type: 'image_url', image_url: imgObj }];
    }

    if (part.type === 'image_url' && part.url) {
      const imgObj = { url: part.url };
      if (part.detail) imgObj.detail = part.detail;
      return [{ type: 'image_url', image_url: imgObj }];
    }

    return [];
  });
}

function toClaudeContent(content) {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  if (!Array.isArray(content)) {
    return [{ type: 'text', text: String(content || '') }];
  }

  return content.flatMap((part) => {
    if (part.type === 'text') {
      return [{ type: 'text', text: part.text || '' }];
    }

    if (part.type === 'image' && part.data && part.mimeType) {
      return [{
        type: 'image',
        source: {
          type: 'base64',
          media_type: part.mimeType,
          data: part.data,
        },
      }];
    }

    if (part.type === 'image_url' && part.url) {
      return [{ type: 'text', text: `Image URL reference: ${part.url}` }];
    }

    return [];
  });
}

function toGeminiParts(content) {
  if (typeof content === 'string') {
    return [{ text: content }];
  }

  if (!Array.isArray(content)) {
    return [{ text: String(content || '') }];
  }

  return content.flatMap((part) => {
    if (part.type === 'text') {
      return [{ text: part.text || '' }];
    }

    if (part.type === 'image' && part.data && part.mimeType) {
      return [{
        inlineData: {
          mimeType: part.mimeType,
          data: part.data,
        },
      }];
    }

    if (part.type === 'image_url' && part.url) {
      return [{ text: `Image URL reference: ${part.url}` }];
    }

    return [];
  });
}

function toPlainText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content || '');

  return content
    .filter((part) => part.type === 'text')
    .map((part) => part.text || '')
    .join('\n\n');
}

/**
 * Convert system content to Claude's system field format.
 * Supports prompt caching: parts with _cacheable=true get cache_control.
 * Falls back to plain string for simple content (e.g. streamExplain calls).
 */
/**
 * @param {boolean} [useCache] - true for real Anthropic API (supports cache_control)
 */
function toClaudeSystem(content, useCache = false) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content || '');

  // Only use cache_control for real Anthropic API; MiniMax compat doesn't support it
  const hasCacheable = useCache && content.some((p) => p._cacheable);
  if (!hasCacheable) return toPlainText(content);

  // Return as array of content blocks with cache_control on cacheable parts
  return content
    .filter((p) => p.type === 'text' && p.text)
    .map((p) => {
      const block = { type: 'text', text: p.text };
      if (p._cacheable) block.cache_control = { type: 'ephemeral' };
      return block;
    });
}

/* ═══════════════════════════════════════════════════════════════════
 * Agent Chat — Non-streaming with tool calling support
 * Returns a unified response: { text, toolCalls, stopReason }
 * ═══════════════════════════════════════════════════════════════════ */

/**
 * Send a chat request that may include tool definitions.
 * Returns the full response (non-streaming for tool call parsing).
 *
 * @param {Object} opts
 * @param {Array}  opts.messages   - [{ role, content }]
 * @param {Array}  [opts.tools]    - provider-specific tool array (already converted)
 * @param {Object} [opts.config]   - override; defaults to loadConfig()
 * @returns {Promise<{ text: string, toolCalls: Array<{id,name,args}>, stopReason: string }>}
 */
export async function chatWithTools({ messages, tools, config: configOverride }) {
  const config = configOverride || await loadConfig();
  if (!config.apiKey) throw new Error('API key not configured');

  switch (config.provider) {
    case PROVIDERS.CLAUDE:
      return chatClaudeTools({ config, messages, tools });
    case PROVIDERS.GEMINI:
      return chatGeminiTools({ config, messages, tools });
    case PROVIDERS.MINIMAX:
      return chatClaudeTools({
        config: { ...config, _baseUrl: 'https://api.minimaxi.com/anthropic' },
        messages, tools,
      });
    case PROVIDERS.ALIYUN:
      return chatOpenAITools({
        config: { ...config, endpoint: 'https://coding.dashscope.aliyuncs.com/v1' },
        messages, tools,
      });
    case PROVIDERS.VOLCENGINE:
      return chatOpenAITools({
        config: { ...config, endpoint: 'https://ark.cn-beijing.volces.com/api/coding/v3' },
        messages, tools,
      });
    case PROVIDERS.OPENAI_COMPAT:
    default:
      return chatOpenAITools({ config, messages, tools });
  }
}

/* ─── OpenAI-compatible tool calling ───────────────────────────── */

async function chatOpenAITools({ config, messages, tools }) {
  const endpoint = (config.endpoint || 'https://api.openai.com/v1').replace(/\/$/, '');
  const body = {
    model: config.model || 'gpt-4o-mini',
    messages: messages.map((m) => {
      // tool-result messages have a special format
      if (m.role === 'tool') {
        return { role: 'tool', tool_call_id: m.tool_call_id, content: m.content };
      }
      // assistant messages with tool calls
      if (m.role === 'assistant' && m.tool_calls) {
        return { role: 'assistant', content: m.content || null, tool_calls: m.tool_calls };
      }
      return { ...m, content: toOpenAIContent(m.content) };
    }),
    temperature: 0.7,
    max_tokens: 8192,
  };
  if (tools?.length) body.tools = tools;

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const json = await response.json();
  const choice = json.choices?.[0];
  const msg = choice?.message || {};

  const toolCalls = (msg.tool_calls || []).map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    args: safeParse(tc.function.arguments),
    _raw: tc,  // keep raw for follow-up messages
  }));

  // Capture token usage from OpenAI-compatible response
  const usage = json.usage ? {
    promptTokens: json.usage.prompt_tokens || 0,
    completionTokens: json.usage.completion_tokens || 0,
    totalTokens: json.usage.total_tokens || 0,
  } : null;

  return {
    text: msg.content || '',
    toolCalls,
    stopReason: choice?.finish_reason || 'stop',
    usage,
  };
}

/* ─── Anthropic Claude tool calling ────────────────────────────── */

async function chatClaudeTools({ config, messages, tools }) {
  const baseUrl = (config._baseUrl || 'https://api.anthropic.com').replace(/\/$/, '');
  const systemMsg = messages.find((m) => m.role === 'system');
  const turns = messages.filter((m) => m.role !== 'system');

  // Convert turns for Claude format
  const claudeTurns = turns.map((m) => {
    if (m.role === 'tool_result') {
      // Claude tool result format
      return {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: m.tool_use_id,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        }],
      };
    }
    if (m.role === 'assistant' && m._claudeContent) {
      return { role: 'assistant', content: m._claudeContent };
    }
    return {
      role: m.role,
      content: toClaudeContent(m.content),
    };
  });

  const body = {
    model: config.model || 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    system: toClaudeSystem(systemMsg?.content, !config._baseUrl),
    messages: claudeTurns,
  };
  if (tools?.length) body.tools = tools;

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const json = await response.json();

  let text = '';
  const toolCalls = [];
  const contentBlocks = json.content || [];

  for (const block of contentBlocks) {
    if (block.type === 'text') {
      text += block.text;
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        name: block.name,
        args: block.input || {},
      });
    }
  }

  // Capture token usage from Claude response
  const usage = json.usage ? {
    promptTokens: json.usage.input_tokens || 0,
    completionTokens: json.usage.output_tokens || 0,
    totalTokens: (json.usage.input_tokens || 0) + (json.usage.output_tokens || 0),
  } : null;

  return {
    text,
    toolCalls,
    stopReason: json.stop_reason || 'end_turn',
    _claudeContent: contentBlocks,  // preserve for follow-up
    usage,
  };
}

/* ─── Google Gemini tool calling ───────────────────────────────── */

async function chatGeminiTools({ config, messages, tools }) {
  const model = config.model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;

  const systemMsg = messages.find((m) => m.role === 'system');
  const turns = messages.filter((m) => m.role !== 'system');

  const contents = turns.map((m) => {
    if (m.role === 'tool_result') {
      return {
        role: 'function',
        parts: [{
          functionResponse: {
            name: m.functionName,
            response: safeParse(m.content),
          },
        }],
      };
    }
    if (m.role === 'assistant' && m._geminiParts) {
      return { role: 'model', parts: m._geminiParts };
    }
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: toGeminiParts(m.content),
    };
  });

  const body = { contents };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: toPlainText(systemMsg.content) }] };
  }
  if (tools?.length) body.tools = tools;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const json = await response.json();
  const parts = json.candidates?.[0]?.content?.parts || [];

  let text = '';
  const toolCalls = [];

  for (const part of parts) {
    if (part.text) {
      text += part.text;
    } else if (part.functionCall) {
      toolCalls.push({
        id: `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: part.functionCall.name,
        args: part.functionCall.args || {},
      });
    }
  }

  // Capture token usage from Gemini response
  const um = json.usageMetadata;
  const usage = um ? {
    promptTokens: um.promptTokenCount || 0,
    completionTokens: um.candidatesTokenCount || 0,
    totalTokens: um.totalTokenCount || 0,
  } : null;

  return {
    text,
    toolCalls,
    stopReason: json.candidates?.[0]?.finishReason || 'STOP',
    _geminiParts: parts,  // preserve for follow-up
    usage,
  };
}

/* ─── Shared helper ────────────────────────────────────────────── */

function safeParse(val) {
  if (typeof val === 'object' && val !== null) return val;
  try { return JSON.parse(val); } catch { return val; }
}

/**
 * Test connection with a simple ping message.
 * Returns { ok: true } or { ok: false, error: string }
 */
export async function testConnection() {
  return new Promise((resolve) => {
    let result = '';
    streamExplain({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Reply with exactly: "LumiNote OK"' },
      ],
      onChunk: (t) => { result += t; },
      onDone: () => { resolve({ ok: true, message: result.trim() }); },
      onError: (e) => { resolve({ ok: false, error: String(e) }); },
    }).catch((e) => { resolve({ ok: false, error: e.message || String(e) }); });
  });
}

/**
 * Fetch the list of available models from the configured OpenAI-compat
 * provider. Only works when provider === OPENAI_COMPAT (other providers use
 * bespoke model dropdowns baked into Options).
 *
 * Returns { ok: true, models: string[] } sorted alphabetically,
 * or { ok: false, error: string }.
 */
export async function listModels() {
  const config = await loadConfig();
  if (config.provider !== PROVIDERS.OPENAI_COMPAT) {
    return { ok: false, error: `listModels is only supported for ${PROVIDERS.OPENAI_COMPAT} provider` };
  }
  if (!config.apiKey) {
    return { ok: false, error: 'API key not configured' };
  }
  const endpoint = (config.endpoint || 'https://api.openai.com/v1').replace(/\/$/, '');
  try {
    const res = await fetch(`${endpoint}/models`, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status} ${res.statusText}${text ? ': ' + text.slice(0, 200) : ''}` };
    }
    const data = await res.json();
    // OpenAI-style: { data: [{id, ...}, ...] }. Some providers return a bare array.
    const items = Array.isArray(data) ? data : (data.data || data.models || []);
    const ids = items
      .map((m) => (typeof m === 'string' ? m : (m.id || m.name || m.model)))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    if (ids.length === 0) {
      return { ok: false, error: 'Provider returned an empty model list' };
    }
    return { ok: true, models: ids };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}
