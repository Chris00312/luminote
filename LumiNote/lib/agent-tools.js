/**
 * LumiNote — Agent Tool Definitions & Dispatcher
 * Defines the tool schema (provider-agnostic) and executes tools via chrome.runtime.sendMessage.
 */

/* ─── Risk Levels ──────────────────────────────────────────────── */

export const RISK = {
  LOW: 'low',         // read-only — execute silently
  MEDIUM: 'medium',   // create / update — execute with inline receipt
  HIGH: 'high',       // delete — require user confirmation before execution
};

/* ─── Tool Definitions (provider-agnostic schema) ──────────────── */

export const TOOL_DEFS = [
  // ─── Memory CRUD ─────────────────────────────────────
  {
    name: 'search_memories',
    description: 'Search Memory Blocks by keyword with optional filters. Returns matching entries. Each result includes a "hasImage" flag indicating whether the entry contains an image. Use this to list images without loading full image data — only call get_memory for specific entries the user wants to view.',
    risk: RISK.LOW,
    parameters: {
      type: 'object',
      properties: {
        query:      { type: 'string', description: 'Search keyword (searches term, note, aiSummary, context, tags)' },
        sourceKind: { type: 'string', enum: ['web', 'pdf'], description: 'Filter by source type' },
        entryType:  { type: 'string', enum: ['text', 'image'], description: 'Filter by entry type' },
        domain:     { type: 'string', description: 'Filter by source domain' },
        dateFrom:   { type: 'string', description: 'ISO date — only entries after this date' },
        dateTo:     { type: 'string', description: 'ISO date — only entries before this date' },
        limit:      { type: 'number', description: 'Max results (default 20)' },
      },
    },
  },
  {
    name: 'get_memory',
    description: 'Retrieve the full Memory Block by ID.',
    risk: RISK.LOW,
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Memory Block ID (e.g. lr_1744027620000_abc1234)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_memory',
    description: 'Create a new Memory Block in LumiNote.',
    risk: RISK.MEDIUM,
    parameters: {
      type: 'object',
      properties: {
        term:        { type: 'string', description: 'The highlighted term or title' },
        entryType:   { type: 'string', enum: ['text'], description: 'Entry type (text only for now)' },
        sourceKind:  { type: 'string', enum: ['web', 'pdf'], description: 'Source type', default: 'web' },
        sourceUrl:   { type: 'string', description: 'URL of the source page' },
        sourceTitle: { type: 'string', description: 'Title of the source page' },
        note:        { type: 'string', description: 'Human-readable note' },
        aiSummary:   { type: 'string', description: 'AI-generated summary' },
        context:     { type: 'string', description: 'Surrounding context captured at mark time' },
        tags:        { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' },
      },
      required: ['term'],
    },
  },
  {
    name: 'update_memory',
    description: 'Update mutable fields of an existing Memory Block.',
    risk: RISK.MEDIUM,
    parameters: {
      type: 'object',
      properties: {
        id:        { type: 'string', description: 'Memory Block ID' },
        term:      { type: 'string', description: 'New title' },
        note:      { type: 'string', description: 'Updated note' },
        aiSummary: { type: 'string', description: 'Updated AI summary' },
        tags:      { type: 'array', items: { type: 'string' }, description: 'Updated tags' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_memory',
    description: 'Soft-delete a Memory Block (moves to trash, recoverable for 15 days).',
    risk: RISK.HIGH,
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Memory Block ID to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'open_memory',
    description: 'Open the original source page/PDF of a Memory Block in a new Chrome tab.',
    risk: RISK.LOW,
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Memory Block ID' },
      },
      required: ['id'],
    },
  },

  // ─── Moodboard Session ──────────────────────────────
  {
    name: 'list_moodboard_sessions',
    description: 'List all Moodboard (灵感板) sessions with card counts.',
    risk: RISK.LOW,
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_moodboard_session',
    description: 'Get full details of a Moodboard session including all cards and their memory entries.',
    risk: RISK.LOW,
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Moodboard session ID (e.g. mb_1706000000000_xyz9876)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_moodboard_session',
    description: 'Create a new empty Moodboard session.',
    risk: RISK.MEDIUM,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Board name (defaults to "Untitled Board")' },
      },
    },
  },
  {
    name: 'update_moodboard_session',
    description: "Update a Moodboard session's name or viewport.",
    risk: RISK.MEDIUM,
    parameters: {
      type: 'object',
      properties: {
        id:   { type: 'string', description: 'Moodboard session ID' },
        name: { type: 'string', description: 'New board name' },
        viewport: {
          type: 'object',
          description: 'Viewport state',
          properties: {
            x:    { type: 'number' },
            y:    { type: 'number' },
            zoom: { type: 'number' },
          },
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_moodboard_session',
    description: 'Permanently delete a Moodboard session and all its card placements.',
    risk: RISK.HIGH,
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Moodboard session ID to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'add_moodboard_card',
    description: 'Add a Memory Block to a Moodboard session as a card at a specific canvas position.',
    risk: RISK.MEDIUM,
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Moodboard session ID' },
        entryId:   { type: 'string', description: 'Memory Block ID to place on the board' },
        x:         { type: 'number', description: 'Canvas X position (default 0)' },
        y:         { type: 'number', description: 'Canvas Y position (default 0)' },
      },
      required: ['sessionId', 'entryId'],
    },
  },
  {
    name: 'remove_moodboard_card',
    description: 'Remove a card from a Moodboard session (does NOT delete the underlying Memory Block).',
    risk: RISK.MEDIUM,
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Moodboard session ID' },
        cardId:    { type: 'string', description: 'Card ID to remove (e.g. mbc_1706000000000_abc1234)' },
      },
      required: ['sessionId', 'cardId'],
    },
  },
];

/* ─── Lookup helpers ───────────────────────────────────────────── */

const toolMap = new Map(TOOL_DEFS.map((t) => [t.name, t]));

export function getToolDef(name) {
  return toolMap.get(name) || null;
}

export function getToolRisk(name) {
  return toolMap.get(name)?.risk || RISK.LOW;
}

/* ─── Message-type mapping (tool name → service worker message) ── */

const MSG_TYPE_MAP = {
  search_memories:           'SEARCH_MEMORIES',
  get_memory:                'GET_MEMORY',
  create_memory:             'CREATE_MEMORY',
  update_memory:             'UPDATE_MEMORY',
  delete_memory:             'DELETE_MEMORY',
  open_memory:               'OPEN_MEMORY',
  list_moodboard_sessions:   'LIST_MOODBOARD_SESSIONS',
  get_moodboard_session:     'GET_MOODBOARD_SESSION',
  create_moodboard_session:  'CREATE_MOODBOARD_SESSION',
  update_moodboard_session:  'UPDATE_MOODBOARD_SESSION',
  delete_moodboard_session:  'DELETE_MOODBOARD_SESSION',
  add_moodboard_card:        'ADD_MOODBOARD_CARD',
  remove_moodboard_card:     'REMOVE_MOODBOARD_CARD',
};

/* ─── Dispatcher — executes a tool via service worker ──────────── */

/**
 * Execute a single tool call by sending a chrome.runtime message.
 * @param {string} toolName
 * @param {Object} args - parsed arguments from the AI
 * @returns {Promise<Object>} - { ok, ... } response from service worker
 */
export async function executeTool(toolName, args = {}) {
  const msgType = MSG_TYPE_MAP[toolName];
  if (!msgType) {
    return { ok: false, error: `Unknown tool: ${toolName}` };
  }

  // Auto-calculate center position for add_moodboard_card when x/y not specified
  if (toolName === 'add_moodboard_card' && !args.x && !args.y && args.sessionId) {
    const pos = await calcCenterPosition(args.sessionId);
    args = { ...args, x: pos.x, y: pos.y };
  }

  // Build the message payload expected by each service worker handler
  const payload = buildPayload(msgType, args);

  const rawResult = await new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response || { ok: false, error: 'No response from service worker' });
      }
    });
  });

  // Extract images before sanitizing (for vision-capable models)
  const _images = extractImages(rawResult);
  const result = sanitizeResult(rawResult);
  if (_images.length) result._images = _images;

  // Notify UI to refresh after mutating operations
  if (result?.ok && MUTATING_TOOLS.has(toolName)) {
    window.dispatchEvent(new CustomEvent('luminote-agent-mutation', {
      detail: { tool: toolName, args },
    }));
  }

  return result;
}

const MUTATING_TOOLS = new Set([
  'create_memory', 'update_memory', 'delete_memory',
  'create_moodboard_session', 'update_moodboard_session', 'delete_moodboard_session',
  'add_moodboard_card', 'remove_moodboard_card',
]);

/* ─── Auto-position: find centroid of existing cards ───────────── */

async function calcCenterPosition(sessionId) {
  const session = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_MOODBOARD_SESSION', id: sessionId }, (res) => {
      resolve(res?.ok ? res.session : null);
    });
  });

  if (!session?.cards?.length) {
    return { x: 200, y: 200 };  // default for empty board
  }

  const cards = session.cards;
  const cx = cards.reduce((sum, c) => sum + (c.x || 0), 0) / cards.length;
  const cy = cards.reduce((sum, c) => sum + (c.y || 0), 0) / cards.length;

  // Offset slightly from center so it doesn't stack on top of an existing card
  const CARD_W = 260, CARD_H = 180;
  return {
    x: Math.round(cx + CARD_W * (Math.random() - 0.3)),
    y: Math.round(cy + CARD_H + 30),
  };
}

/* ─── Result sanitizer — strip base64 images to prevent token explosion */

function sanitizeResult(result) {
  if (!result || typeof result !== 'object') return result;
  return JSON.parse(JSON.stringify(result, (key, value) => {
    // Strip base64 data URLs (imageUrl, imageData, etc.)
    if (typeof value === 'string' && value.length > 500 && /^data:[^;]+;base64,/.test(value)) {
      return '[image:base64 omitted]';
    }
    return value;
  }));
}

/**
 * Extract image data from a raw (pre-sanitized) tool result.
 * Returns an array of { mimeType, data } objects (base64 without prefix).
 * Used by agent-engine to inject images into vision-capable models.
 */
export function extractImages(result) {
  if (!result || typeof result !== 'object') return [];
  const images = [];
  JSON.stringify(result, (key, value) => {
    if (typeof value === 'string' && value.length > 500) {
      const m = value.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (m) images.push({ mimeType: m[1], data: m[2] });
    }
    return value;
  });
  return images;
}

/* ─── Payload builders (match service worker handler expectations) */

function buildPayload(type, args) {
  switch (type) {
    case 'CREATE_MEMORY':
      return { type, block: args };

    case 'UPDATE_MEMORY': {
      const { id, ...fields } = args;
      return { type, id, fields };
    }

    case 'DELETE_MEMORY':
    case 'GET_MEMORY':
    case 'OPEN_MEMORY':
      return { type, id: args.id };

    case 'SEARCH_MEMORIES': {
      const { query, ...filters } = args;
      return { type, query: query || '', filters };
    }

    case 'LIST_MOODBOARD_SESSIONS':
      return { type };

    case 'GET_MOODBOARD_SESSION':
    case 'DELETE_MOODBOARD_SESSION':
      return { type, id: args.id };

    case 'CREATE_MOODBOARD_SESSION':
      return { type, name: args.name };

    case 'UPDATE_MOODBOARD_SESSION': {
      const { id, ...fields } = args;
      return { type, id, fields };
    }

    case 'ADD_MOODBOARD_CARD':
      return { type, sessionId: args.sessionId, entryId: args.entryId, x: args.x || 0, y: args.y || 0 };

    case 'REMOVE_MOODBOARD_CARD':
      return { type, sessionId: args.sessionId, cardId: args.cardId };

    default:
      return { type, ...args };
  }
}

/* ─── Schema converters (tool defs → provider-specific formats) ── */

/**
 * Convert to OpenAI / DeepSeek tools format
 */
export function toOpenAITools() {
  return TOOL_DEFS.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/**
 * Convert to Anthropic Claude tools format
 */
export function toClaudeTools() {
  return TOOL_DEFS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

/**
 * Convert to Google Gemini tools format
 */
export function toGeminiTools() {
  return [{
    functionDeclarations: TOOL_DEFS.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    })),
  }];
}
