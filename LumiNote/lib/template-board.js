/**
 * LumiNote — Template Moodboard (new-user self-intro)
 *
 * Pre-populated "Welcome to LumiNote" / "欢迎使用 LumiNote" board created on
 * fresh install. Six self-intro cards explain the product (What is LumiNote
 * / How to Mark / Three explain depths / Moodboards / Agent Chat / MCP).
 *
 * Replaces the previous hardcoded Chinese "旅行" board with Xiaohongshu URLs
 * which was not appropriate for English users. Content now switches on
 * install-time locale, with all sourceUrl fields blank (no external
 * dependencies; the board is purely onboarding content).
 */

import { getLocale } from './i18n.js';

/* ─── ID generators (same format as notebook.js / moodboard.js) ──── */

function _rid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function generateEntryId()   { return `lr_${_rid()}`; }
function generateCardId()    { return `mbc_${_rid()}`; }
function generateSessionId() { return `mb_${_rid()}`; }

/* ─── Card content (locale-keyed) ──────────────────────────────── */

/**
 * 6 self-intro cards. Laid out on a 3x2 grid; viewport is framed on the
 * cluster. Positions in world coordinates (not screen pixels) so they work
 * regardless of canvas zoom.
 */
const CARD_POSITIONS = [
  { x:  100, y:  80, w: 340, h: 200 },  // top-left
  { x:  480, y:  80, w: 340, h: 200 },  // top-center
  { x:  860, y:  80, w: 340, h: 200 },  // top-right
  { x:  100, y: 320, w: 340, h: 200 },  // bottom-left
  { x:  480, y: 320, w: 340, h: 200 },  // bottom-center
  { x:  860, y: 320, w: 340, h: 200 },  // bottom-right
];

const CARD_CONTENT = {
  en: {
    sessionName: 'Welcome to LumiNote',
    cards: [
      { term: 'What is LumiNote?',
        note: 'Your internet memory library. Mark what matters on any page, build a searchable knowledge base.' },
      { term: 'How to Mark',
        note: 'Select any text → click the green Mark bubble. Works on web pages and PDFs.' },
      { term: 'Three Explain Depths',
        note: 'Brief · Detailed · Deep. Pick the depth that fits the moment.' },
      { term: 'Moodboards',
        note: 'Drop memories on an infinite canvas. Rearrange, resize, export as PNG.' },
      { term: 'Agent Chat',
        note: 'Ask an AI agent questions about this very board — it can read, add, and update cards.' },
      { term: 'MCP Integration',
        note: 'Connect any MCP-compatible AI (Claude, etc.) to read/write your memory library.' },
    ],
  },
  zh: {
    sessionName: '欢迎使用 LumiNote',
    cards: [
      { term: '什么是 LumiNote？',
        note: '你的互联网记忆库。标记任意页面上重要的内容，构建可搜索的知识库。' },
      { term: '如何标记',
        note: '选中任意文字 → 点击绿色的 Mark 气泡。网页和 PDF 都支持。' },
      { term: '三种解释深度',
        note: '简洁 · 详细 · 深度。选择当下最合适的深度。' },
      { term: '灵感板',
        note: '把记忆放到无限画布上，自由拖动、缩放，整块导出为 PNG。' },
      { term: 'Agent 对话',
        note: '向 AI agent 提问这个板子上的内容——它可以读取、添加、更新卡片。' },
      { term: 'MCP 集成',
        note: '连接任意 MCP 兼容的 AI（如 Claude）来读写你的记忆库。' },
    ],
  },
};

/* ─── Public API ───────────────────────────────────────────────── */

/**
 * Build a fresh template moodboard with unique IDs.
 * Returns notebook entries and a ready-to-store session object.
 *
 * @param {string} [locale] — Optional override; defaults to current UI locale
 * @returns {{ entries: Object[], session: Object }}
 */
export function createTemplateBoard(locale) {
  const effectiveLocale = (locale || getLocale() || 'en').toLowerCase();
  const lang = CARD_CONTENT[effectiveLocale] ? effectiveLocale
              : effectiveLocale.startsWith('zh') ? 'zh'
              : 'en';
  const content = CARD_CONTENT[lang];

  const now = Date.now();
  const sessionId = generateSessionId();

  // Build notebook entries (matching the schema in notebook.js → saveEntry)
  const entries = content.cards.map((card) => ({
    id: generateEntryId(),
    entryType: 'text',
    term: card.term,
    context: '',
    note: card.note,
    aiSummary: '',
    explanation: '',
    sourceUrl: '',
    sourceUrlNormalized: '',
    sourceTitle: card.term,
    sourceKind: 'web',
    sourcePage: null,
    sourceName: 'LumiNote',
    sourceAnchor: null,
    sourceLocator: null,
    imageUrl: '',
    imageAlt: '',
    timestamp: now,
    tags: ['getting-started'],
  }));

  // Build the moodboard session
  const session = {
    id: sessionId,
    name: content.sessionName,
    createdAt: now,
    updatedAt: now,
    pinned: true,
    viewport: { x: 200, y: 150, zoom: 0.8 },
    cards: entries.map((entry, i) => ({
      cardId: generateCardId(),
      entryId: entry.id,
      ...CARD_POSITIONS[i],
      textHidden: false,
    })),
  };

  return { entries, session };
}
