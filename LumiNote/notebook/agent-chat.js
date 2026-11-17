/**
 * LumiNote — Agent Chat UI
 * Bottom-center floating chat panel with glassmorphism.
 * Stores conversation in sessionStorage (cleared on browser close).
 */

import { runAgentTurn } from '../lib/agent-engine.js';
import { RISK } from '../lib/agent-tools.js';
import { t } from '../lib/i18n.js';
import { renderMd } from '../lib/render-md.js';
import { runDeepThink } from '../lib/deep-think.js';

const $ = (id) => document.getElementById(id);

/* ─── State ────────────────────────────────────────────────────── */

const SESSION_KEY = 'luminote_agent_chat';
const LOG_KEY = 'luminote_agent_log';

let messages = [];    // internal conversation history
let isRunning = false;
let deepThinkMode = false; // toggle state for deep think button
let getContextFn = null;  // set by initAgentChat()
let agentLog = [];        // debug log — persists in sessionStorage
let sessionTokens = { prompt: 0, completion: 0, total: 0 };  // token usage this session

/* ─── Debug Logger ─────────────────────────────────────────────── */

function log(level, event, data = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,   // 'info' | 'warn' | 'error'
    event,   // e.g. 'send', 'tool_call', 'tool_result', 'api_error', 'response'
    ...data,
  };
  agentLog.push(entry);
  // Keep max 200 entries
  if (agentLog.length > 200) agentLog = agentLog.slice(-200);

  const tag = `[Agent:${level}]`;
  if (level === 'error') {
    console.error(tag, event, data);
  } else if (level === 'warn') {
    console.warn(tag, event, data);
  } else {
    console.log(tag, event, data);
  }

  // Persist to sessionStorage
  try { sessionStorage.setItem(LOG_KEY, JSON.stringify(agentLog)); } catch {}
}

function restoreLog() {
  try {
    const raw = sessionStorage.getItem(LOG_KEY);
    if (raw) agentLog = JSON.parse(raw);
  } catch { agentLog = []; }
}

/** Expose globally for DevTools access: LumiNoteAgentLog */
window.LumiNoteAgentLog = {
  get entries() { return agentLog; },
  dump() {
    console.table(agentLog);
    return agentLog;
  },
  clear() {
    agentLog = [];
    try { sessionStorage.removeItem(LOG_KEY); } catch {}
    console.log('[Agent] Log cleared');
  },
  errors() {
    return agentLog.filter((e) => e.level === 'error');
  },
};

/* ─── Init / Destroy ───────────────────────────────────────────── */

/**
 * Initialize the agent chat UI.
 * @param {Function} getContext - () => { view, activeSession, totalMemories }
 */
export function initAgentChat(getContext) {
  getContextFn = getContext;
  restoreSession();
  restoreLog();
  bindEvents();
  renderAllMessages();
  log('info', 'init', { messagesRestored: messages.length });
}

export function destroyAgentChat() {
  saveSession();
}

/* ─── Session persistence (sessionStorage) ─────────────────────── */

function saveSession() {
  try {
    const data = messages.map((m) => ({
      role: m.role,
      content: m.content,
      toolName: m.toolName,
      toolArgs: m.toolArgs,
      toolOk: m.toolOk,
      toolCallId: m.toolCallId,
      toolCalls: m.toolCalls,  // preserve for multi-turn tool_calls pairing
    }));
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    sessionStorage.setItem(SESSION_KEY + '_tokens', JSON.stringify(sessionTokens));
  } catch { /* quota exceeded — non-critical */ }
}

function restoreSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      messages = JSON.parse(raw);
    }
    const tokens = sessionStorage.getItem(SESSION_KEY + '_tokens');
    if (tokens) {
      Object.assign(sessionTokens, JSON.parse(tokens));
    }
  } catch {
    messages = [];
  }
}

/* ─── Event binding ────────────────────────────────────────────── */

function bindEvents() {
  // FAB toggle
  const fab = $('agent-fab');
  const panel = $('agent-panel');
  const closeBtn = $('agent-close');
  const sendBtn = $('agent-send');
  const input = $('agent-input');

  fab?.addEventListener('click', () => togglePanel(true));
  closeBtn?.addEventListener('click', () => togglePanel(false));

  sendBtn?.addEventListener('click', handleSend);
  $('agent-deep-think')?.addEventListener('click', toggleDeepThinkMode);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Auto-resize textarea
  input?.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  });
}

function togglePanel(show) {
  const fab = $('agent-fab');
  const panel = $('agent-panel');
  if (!panel || !fab) return;

  if (show) {
    panel.hidden = false;
    fab.classList.add('agent-fab--hidden');
    $('agent-input')?.focus();
    scrollToBottom();
  } else {
    panel.hidden = true;
    fab.classList.remove('agent-fab--hidden');
  }
}

/* ─── Send message ─────────────────────────────────────────────── */

async function handleSend() {
  const input = $('agent-input');
  const text = input?.value.trim();
  if (!text || isRunning) return;

  input.value = '';
  input.style.height = 'auto';

  // Add user message
  const userMsg = { role: 'user', content: text };
  messages.push(userMsg);
  appendBubble('user', text);
  log('info', 'user_send', { text, deepThink: deepThinkMode });

  // Deep think mode: route to multi-provider orchestration
  if (deepThinkMode) {
    isRunning = true;
    await runDeepThinkSend(text);
    return;
  }

  const ctx = getContextFn?.();
  log('info', 'context', { view: ctx?.view, activeSession: ctx?.activeSession?.name || null, totalMemories: ctx?.totalMemories });

  isRunning = true;
  setSendEnabled(false);

  let thinkingEl = null;

  try {
    await runAgentTurn({
      messages: [...messages],
      getContext: getContextFn,

      onThinking: () => {
        thinkingEl = appendThinking();
        log('info', 'thinking');
      },

      onToolCall: (toolName, args, risk) => {
        log('info', 'tool_call_confirm', { toolName, args, risk });
        return showConfirmation(toolName, args);
      },

      onAssistantIntermediate: (assistantMsg) => {
        // Save intermediate assistant message (with tool_calls) to history.
        // This is critical: on the next turn, tool_result messages MUST
        // follow an assistant message with tool_calls, or OpenAI/DeepSeek rejects.
        messages.push({
          role: 'assistant',
          content: assistantMsg.content || '',
          toolCalls: assistantMsg.toolCalls,
          _raw: assistantMsg._raw,
        });
        log('info', 'assistant_intermediate', {
          toolCalls: assistantMsg.toolCalls?.map((tc) => tc.name),
        });
      },

      onToolResult: (toolName, args, result, tcId) => {
        removeThinking(thinkingEl);
        thinkingEl = null;
        appendToolReceipt(toolName, args, result);

        const ok = result?.ok !== false;
        log(ok ? 'info' : 'warn', 'tool_result', { toolName, args, ok, tcId });

        messages.push({
          role: 'tool_result',
          toolCallId: tcId || '',
          toolName,
          toolArgs: args,
          toolOk: ok,
          content: JSON.stringify(result),
        });
      },

      onText: async (text) => {
        removeThinking(thinkingEl);
        thinkingEl = null;

        // Streaming-style progressive rendering
        const el = document.createElement('div');
        el.className = 'agent-msg agent-msg--assistant';
        messagesEl()?.appendChild(el);

        let rendered = '';
        const step = Math.max(1, Math.ceil(text.length / 120));
        for (let i = 0; i < text.length; i += step) {
          rendered = text.slice(0, i + step);
          el.innerHTML = renderMd(rendered);
          scrollToBottom();
          await new Promise((r) => requestAnimationFrame(r));
        }
        el.innerHTML = renderMd(text);
        scrollToBottom();
        log('info', 'assistant_text', { length: text.length, preview: text.slice(0, 120) });
      },

      onError: (errMsg) => {
        removeThinking(thinkingEl);
        thinkingEl = null;
        appendBubble('error', errMsg);
        log('error', 'agent_error', { error: errMsg });
      },

      onUsage: (usage) => {
        sessionTokens.prompt += usage.promptTokens || 0;
        sessionTokens.completion += usage.completionTokens || 0;
        sessionTokens.total += usage.totalTokens || 0;
        updateTokenBadge();
        log('info', 'usage', usage);
      },

      onDone: (assistantMsg) => {
        messages.push({
          role: 'assistant',
          content: assistantMsg.content,
        });
        saveSession();
        log('info', 'turn_done', { sessionTokens: { ...sessionTokens } });
      },
    });
  } catch (e) {
    removeThinking(thinkingEl);
    appendBubble('error', e.message || String(e));
    log('error', 'turn_exception', { error: e.message, stack: e.stack });
  }

  isRunning = false;
  setSendEnabled(true);
}

/* ─── Deep Think ───────────────────────────────────────────────── */

function toggleDeepThinkMode() {
  if (isRunning) return;
  deepThinkMode = !deepThinkMode;
  const deepBtn = $('agent-deep-think');
  deepBtn?.classList.toggle('active', deepThinkMode);
}

async function runDeepThinkSend(text) {
  const deepBtn = $('agent-deep-think');
  const statusEl = $('agent-deep-status');

  if (deepBtn) deepBtn.disabled = true;
  setSendEnabled(false);

  function setStatus(msg) {
    if (!statusEl) return;
    if (msg) {
      statusEl.textContent = msg;
      statusEl.classList.add('visible');
    } else {
      statusEl.textContent = '';
      statusEl.classList.remove('visible');
    }
  }

  // Assistant bubble for streaming synthesis
  const assistantEl = document.createElement('div');
  assistantEl.className = 'agent-msg agent-msg--assistant';
  messagesEl()?.appendChild(assistantEl);
  scrollToBottom();

  let synthesisText = '';

  await runDeepThink({
    messages,
    onStatus: setStatus,
    onChunk: (chunk) => {
      synthesisText += chunk;
      assistantEl.innerHTML = renderMd(synthesisText);
      scrollToBottom();
    },
    onExperts: (expertMap) => {
      const toggle = document.createElement('button');
      toggle.className = 'agent-experts-toggle';
      toggle.innerHTML =
        `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>` +
        ` View expert opinions`;

      const panel = document.createElement('div');
      panel.className = 'agent-experts-panel';
      panel.hidden = true;
      panel.innerHTML = Object.entries(expertMap)
        .map(([label, txt]) => `<div><strong>${label}:</strong> ${renderMd(txt)}</div>`)
        .join('<hr style="margin:6px 0;border:none;border-top:1px solid rgba(0,0,0,0.08)">');

      toggle.addEventListener('click', () => {
        panel.hidden = !panel.hidden;
        toggle.querySelector('svg').style.transform = panel.hidden ? '' : 'rotate(180deg)';
      });

      assistantEl.after(toggle);
      toggle.after(panel);
    },
    onUsage: ({ expertTokens, synthesisTokens }) => {
      sessionTokens.prompt += expertTokens;
      sessionTokens.completion += synthesisTokens;
      sessionTokens.total += expertTokens + synthesisTokens;
      updateTokenBadge();
      log('info', 'deep_think_usage', { expertTokens, synthesisTokens });
    },
    onDone: async () => {
      setStatus(null);
      messages.push({ role: 'assistant', content: synthesisText });
      saveSession();

      // Auto-create memory card with [深度思考] prefix
      try {
        const { saveEntry } = await import('../lib/notebook.js');
        const userQ = messages.filter((m) => m.role === 'user').pop()?.content ?? '';
        const title = userQ.length > 40 ? userQ.slice(0, 40) + '…' : userQ;
        await saveEntry({
          entryType: 'text',
          term: `${t('deep_think_prefix')} ${title}`,
          note: synthesisText,
          aiSummary: synthesisText,
          sourceKind: 'agent',
          sourceTitle: 'LumiNote Deep Think',
          tags: ['deep-think'],
        });
        log('info', 'deep_think_card_created', { title: `${t('deep_think_prefix')} ${title}` });
      } catch (e) {
        log('warn', 'deep_think_card_failed', { error: e.message });
      }

      isRunning = false;
      if (deepBtn) deepBtn.disabled = false;
      setSendEnabled(true);
      scrollToBottom();
    },
    onError: (err) => {
      setStatus(null);
      appendBubble('error', `Deep Think error: ${err}`);
      isRunning = false;
      if (deepBtn) deepBtn.disabled = false;
      setSendEnabled(true);
    },
  });
}

/* ─── Render helpers ───────────────────────────────────────────── */

const messagesEl = () => $('agent-messages');

function appendBubble(type, text) {
  const el = document.createElement('div');
  el.className = `agent-msg agent-msg--${type}`;
  if (type === 'assistant') {
    el.innerHTML = renderMd(text);
  } else {
    el.textContent = text;
  }
  messagesEl()?.appendChild(el);
  scrollToBottom();
  return el;
}

function appendThinking() {
  const statusEl = $('agent-deep-status');
  if (statusEl) {
    statusEl.textContent = 'Thinking…';
    statusEl.classList.add('visible');
  }
  return statusEl;
}

function removeThinking(el) {
  if (el) {
    el.textContent = '';
    el.classList.remove('visible');
  }
}

function appendToolReceipt(toolName, args, result) {
  const ok = result?.ok !== false;
  const el = document.createElement('div');
  el.className = `agent-tool-receipt${ok ? '' : ' agent-tool-receipt--error'}`;

  const icon = ok
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  const label = formatToolLabel(toolName, args);
  el.innerHTML = `${icon} <span>${label}</span>`;
  messagesEl()?.appendChild(el);
  scrollToBottom();
}

function formatToolLabel(name, args) {
  const labels = {
    search_memories:          () => `Searched: "${args.query || '...'}"`,
    get_memory:               () => `Read memory: ${shortId(args.id)}`,
    create_memory:            () => `Created: "${args.term || '...'}"`,
    update_memory:            () => `Updated: ${shortId(args.id)}`,
    delete_memory:            () => `Deleted: ${shortId(args.id)}`,
    open_memory:              () => `Opened source: ${shortId(args.id)}`,
    list_moodboard_sessions:  () => 'Listed moodboards',
    get_moodboard_session:    () => `Read board: ${shortId(args.id)}`,
    create_moodboard_session: () => `Created board: "${args.name || 'Untitled'}"`,
    update_moodboard_session: () => `Updated board: ${shortId(args.id)}`,
    delete_moodboard_session: () => `Deleted board: ${shortId(args.id)}`,
    add_moodboard_card:       () => `Added card to board`,
    remove_moodboard_card:    () => `Removed card from board`,
  };
  return (labels[name] || (() => name))();
}

function shortId(id) {
  if (!id) return '...';
  return id.length > 20 ? id.slice(0, 12) + '…' : id;
}

function scrollToBottom() {
  const el = messagesEl();
  if (el) {
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }
}

function setSendEnabled(enabled) {
  const btn = $('agent-send');
  if (btn) btn.disabled = !enabled;
}

/* ─── Token usage badge ───────────────────────────────────────── */

function updateTokenBadge() {
  let badge = $('agent-token-badge');
  if (!badge) {
    // Create badge inside the panel header
    const header = document.querySelector('.agent-header');
    if (!header) return;
    badge = document.createElement('span');
    badge.id = 'agent-token-badge';
    badge.className = 'agent-token-badge';
    badge.title = 'Tokens used this session (prompt + completion)';
    header.appendChild(badge);
  }
  const t = sessionTokens.total;
  badge.textContent = t >= 1000 ? `${(t / 1000).toFixed(1)}k tokens` : `${t} tokens`;
  badge.hidden = t === 0;
}

/* ─── Confirmation dialog (for high-risk actions) ──────────────── */

function showConfirmation(toolName, args) {
  return new Promise((resolve) => {
    const container = messagesEl();
    if (!container) { resolve(false); return; }

    const el = document.createElement('div');
    el.className = 'agent-confirm';

    const desc = describeHighRiskAction(toolName, args);

    el.innerHTML = `
      <span class="agent-confirm__text">${desc}</span>
      <button class="agent-confirm__btn agent-confirm__btn--no" type="button">${t('agent_cancel') || 'Cancel'}</button>
      <button class="agent-confirm__btn agent-confirm__btn--yes" type="button">${t('agent_confirm') || 'Confirm'}</button>
    `;

    const yesBtn = el.querySelector('.agent-confirm__btn--yes');
    const noBtn = el.querySelector('.agent-confirm__btn--no');

    const cleanup = (result) => {
      yesBtn.disabled = true;
      noBtn.disabled = true;
      el.style.opacity = '0.5';
      resolve(result);
    };

    yesBtn.addEventListener('click', () => cleanup(true), { once: true });
    noBtn.addEventListener('click', () => cleanup(false), { once: true });

    container.appendChild(el);
    scrollToBottom();
  });
}

function describeHighRiskAction(toolName, args) {
  if (toolName === 'delete_memory') {
    return `${t('agent_confirm_delete_memory') || 'Delete memory block'} "${args.id || '...'}"?`;
  }
  if (toolName === 'delete_moodboard_session') {
    return `${t('agent_confirm_delete_board') || 'Delete moodboard'} "${args.id || '...'}"?`;
  }
  return `${t('agent_confirm_action') || 'Execute'}: ${toolName}?`;
}

/* ─── Render all stored messages (on init) ─────────────────────── */

function renderAllMessages() {
  const container = messagesEl();
  if (!container) return;
  container.innerHTML = '';

  for (const msg of messages) {
    if (msg.role === 'user') {
      appendBubble('user', msg.content);
    } else if (msg.role === 'assistant') {
      appendBubble('assistant', msg.content);
    } else if (msg.role === 'tool_result') {
      appendToolReceipt(msg.toolName, msg.toolArgs || {}, { ok: msg.toolOk !== false });
    }
  }
}
