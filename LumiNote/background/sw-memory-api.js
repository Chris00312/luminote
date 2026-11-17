/**
 * sw-memory-api.js — Memory + Moodboard API handlers.
 */

import { saveEntry, getAllEntries, updateEntry, deleteEntry, searchEntries } from '../lib/notebook.js';
import { getAllSessions, getSession, createSession, updateSession, deleteSession, generateCardId } from '../lib/moodboard.js';
import { testConnection } from '../lib/api-providers.js';
import { getCapability } from '../lib/plan.js';

const PDF_VIEWER_PATH = 'pdf-viewer/pdf-viewer.html';
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'file:', 'chrome-extension:']);

function _isSafeUrl(url) {
  try { return ALLOWED_PROTOCOLS.has(new URL(url).protocol); } catch { return false; }
}

/* ─── OpenClaw Memory API handlers ─────────────────────────────── */

export async function handleCreateMemory(message, sendResponse) {
  try {
    const block = message.block || message;
    const id = await saveEntry({
      term: block.term || '',
      entryType: block.entryType || 'text',
      sourceKind: block.sourceKind || 'manual',
      sourceUrl: block.sourceUrl || '',
      sourceTitle: block.sourceTitle || '',
      sourcePage: block.sourcePage ?? null,
      sourceName: block.sourceName || '',
      context: block.context || '',
      note: block.note || '',
      aiSummary: block.aiSummary || '',
      tags: block.tags || [],
      imageUrl: block.imageUrl || '',
      imageAlt: block.imageAlt || '',
      sourceAnchor: block.sourceAnchor || null,
      sourceLocator: block.sourceLocator || null,
    });
    sendResponse({ ok: true, id });
  } catch (error) {
    sendResponse({ ok: false, error: error.message || String(error) });
  }
}

export async function handleUpdateMemory(message, sendResponse) {
  try {
    const { id, fields } = message;
    if (!id) {
      sendResponse({ ok: false, error: 'Missing id.' });
      return;
    }
    // Only allow mutable fields
    const allowed = {};
    if (fields.note !== undefined) allowed.note = fields.note;
    if (fields.aiSummary !== undefined) allowed.aiSummary = fields.aiSummary;
    if (fields.tags !== undefined) allowed.tags = fields.tags;
    if (fields.term !== undefined) allowed.term = fields.term;

    await updateEntry(id, allowed);
    sendResponse({ ok: true });
  } catch (error) {
    sendResponse({ ok: false, error: error.message || String(error) });
  }
}

export async function handleDeleteMemory(message, sendResponse) {
  try {
    const { id } = message;
    if (!id) {
      sendResponse({ ok: false, error: 'Missing id.' });
      return;
    }
    await deleteEntry(id);
    sendResponse({ ok: true });
  } catch (error) {
    sendResponse({ ok: false, error: error.message || String(error) });
  }
}

export async function handleSearchMemories(message, sendResponse) {
  try {
    const query = message.query || '';
    const filters = message.filters || {};
    let results = await searchEntries(query);

    // Apply optional filters
    if (filters.sourceKind) {
      results = results.filter((e) => e.sourceKind === filters.sourceKind);
    }
    if (filters.entryType) {
      results = results.filter((e) => e.entryType === filters.entryType);
    }
    if (filters.domain) {
      const domain = filters.domain.toLowerCase();
      results = results.filter((e) => {
        try {
          return new URL(e.sourceUrl).hostname.toLowerCase().includes(domain);
        } catch { return false; }
      });
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      results = results.filter((e) => (e.timestamp || 0) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime();
      results = results.filter((e) => (e.timestamp || 0) <= to);
    }

    const limit = Number.isFinite(filters.limit) ? filters.limit : 50;
    results = results.slice(0, limit);

    // Return slim results — only essential fields for listing.
    // Full data (note, aiSummary, context, imageUrl) fetched via get_memory on demand.
    const slim = results.map((e) => ({
      id: e.id,
      term: e.term,
      entryType: e.entryType || 'text',
      sourceKind: e.sourceKind || 'web',
      sourceUrl: e.sourceUrl || '',
      sourceTitle: e.sourceTitle || '',
      timestamp: e.timestamp || 0,
      tags: e.tags || [],
      hasImage: Boolean(e.imageUrl || e.imageData),
      notePreview: (e.note || '').slice(0, 80) || (e.aiSummary || '').slice(0, 80) || '',
    }));

    sendResponse({ ok: true, results: slim, total: slim.length });
  } catch (error) {
    sendResponse({ ok: false, error: error.message || String(error), results: [] });
  }
}

export async function handleGetMemory(message, sendResponse) {
  try {
    const { id } = message;
    if (!id) {
      sendResponse({ ok: false, error: 'Missing id.' });
      return;
    }
    const entries = await getAllEntries();
    const entry = entries.find((e) => e.id === id);
    if (!entry) {
      sendResponse({ ok: false, error: `Memory not found: ${id}` });
      return;
    }
    sendResponse({ ok: true, memory: entry });
  } catch (error) {
    sendResponse({ ok: false, error: error.message || String(error) });
  }
}

export async function handleOpenMemory(message, sendResponse) {
  try {
    const { id } = message;
    if (!id) {
      sendResponse({ ok: false, error: 'Missing id.' });
      return;
    }
    const entries = await getAllEntries();
    const entry = entries.find((e) => e.id === id);
    if (!entry) {
      sendResponse({ ok: false, error: `Memory not found: ${id}` });
      return;
    }

    const result = {
      ok: true,
      sourceUrl: entry.sourceUrl || '',
      sourceTitle: entry.sourceTitle || '',
      sourceKind: entry.sourceKind || 'web',
      sourcePage: entry.sourcePage ?? null,
      sourceAnchor: entry.sourceAnchor || null,
      sourceLocator: entry.sourceLocator || null,
      imageUrl: entry.imageUrl || '',
    };

    // If there's a URL, open it in a new tab (with protocol allowlist)
    if (entry.sourceUrl) {
      if (entry.sourceKind === 'pdf') {
        const viewerUrl = chrome.runtime.getURL(
          `${PDF_VIEWER_PATH}?src=${encodeURIComponent(entry.sourceUrl)}&page=${entry.sourcePage || 1}&entryId=${entry.id}`
        );
        await chrome.tabs.create({ url: viewerUrl });
      } else if (_isSafeUrl(entry.sourceUrl)) {
        await chrome.tabs.create({ url: entry.sourceUrl });
      }
    }

    sendResponse(result);
  } catch (error) {
    sendResponse({ ok: false, error: error.message || String(error) });
  }
}

/* ─── Moodboard handlers ───────────────────────────────────────── */

export async function handleListMoodboardSessions(sendResponse) {
  try {
    const sessions = await getAllSessions();
    const summaries = sessions.map(({ id, name, createdAt, updatedAt, cards }) => ({
      id, name, createdAt, updatedAt, cardCount: cards?.length || 0,
    }));
    sendResponse({ ok: true, sessions: summaries });
  } catch (error) {
    sendResponse({ ok: false, error: error.message || String(error) });
  }
}

export async function handleGetMoodboardSession(message, sendResponse) {
  try {
    const { id } = message;
    if (!id) { sendResponse({ ok: false, error: 'Missing id.' }); return; }
    const session = await getSession(id);
    if (!session) { sendResponse({ ok: false, error: `Session not found: ${id}` }); return; }

    // Enrich cards with memory entry data
    const entries = await getAllEntries();
    const entryMap = Object.fromEntries(entries.map((e) => [e.id, e]));
    const enrichedCards = (session.cards || []).map((c) => {
      const entry = entryMap[c.entryId];
      return {
        ...c,
        entry: entry ? {
          id: entry.id, term: entry.term, entryType: entry.entryType,
          note: entry.note, aiSummary: entry.aiSummary,
          sourceUrl: entry.sourceUrl, sourceTitle: entry.sourceTitle,
          tags: entry.tags, timestamp: entry.timestamp,
        } : null,
      };
    });

    sendResponse({ ok: true, session: { ...session, cards: enrichedCards } });
  } catch (error) {
    sendResponse({ ok: false, error: error.message || String(error) });
  }
}

export async function handleCreateMoodboardSession(message, sendResponse) {
  try {
    // Board count is unlimited in this build; getCapability returns Infinity.
    const limit = await getCapability('maxBoards');
    if (limit !== Infinity) {
      const allSessions = await getAllSessions();
      if (allSessions.length >= limit) {
        sendResponse({ ok: false, error: `This build allows up to ${limit} boards.` });
        return;
      }
    }

    const { name } = message;
    const session = await createSession({ name: name || 'Untitled Board' });
    sendResponse({ ok: true, session });
  } catch (error) {
    sendResponse({ ok: false, error: error.message || String(error) });
  }
}

export async function handleUpdateMoodboardSession(message, sendResponse) {
  try {
    const { id, fields } = message;
    if (!id) { sendResponse({ ok: false, error: 'Missing id.' }); return; }
    const session = await getSession(id);
    if (!session) { sendResponse({ ok: false, error: `Session not found: ${id}` }); return; }

    const allowed = {};
    if (fields.name !== undefined) allowed.name = fields.name;
    if (fields.viewport !== undefined) allowed.viewport = fields.viewport;

    await updateSession(id, allowed);
    sendResponse({ ok: true });
  } catch (error) {
    sendResponse({ ok: false, error: error.message || String(error) });
  }
}

export async function handleDeleteMoodboardSession(message, sendResponse) {
  try {
    const { id } = message;
    if (!id) { sendResponse({ ok: false, error: 'Missing id.' }); return; }
    await deleteSession(id);
    sendResponse({ ok: true });
  } catch (error) {
    sendResponse({ ok: false, error: error.message || String(error) });
  }
}

export async function handleAddMoodboardCard(message, sendResponse) {
  try {
    const { sessionId, entryId, x, y } = message;
    if (!sessionId || !entryId) {
      sendResponse({ ok: false, error: 'Missing sessionId or entryId.' });
      return;
    }
    const session = await getSession(sessionId);
    if (!session) { sendResponse({ ok: false, error: `Session not found: ${sessionId}` }); return; }

    const cardId = generateCardId();
    const card = { cardId, entryId, x: x ?? 0, y: y ?? 0 };
    const cards = [...(session.cards || []), card];
    await updateSession(sessionId, { cards });
    sendResponse({ ok: true, card });
  } catch (error) {
    sendResponse({ ok: false, error: error.message || String(error) });
  }
}

export async function handleRemoveMoodboardCard(message, sendResponse) {
  try {
    const { sessionId, cardId } = message;
    if (!sessionId || !cardId) {
      sendResponse({ ok: false, error: 'Missing sessionId or cardId.' });
      return;
    }
    const session = await getSession(sessionId);
    if (!session) { sendResponse({ ok: false, error: `Session not found: ${sessionId}` }); return; }

    const cards = (session.cards || []).filter((c) => c.cardId !== cardId);
    await updateSession(sessionId, { cards });
    sendResponse({ ok: true });
  } catch (error) {
    sendResponse({ ok: false, error: error.message || String(error) });
  }
}

/* ─── Test connection ───────────────────────────────────────────── */

export async function handleTestConnection(sendResponse) {
  try {
    const result = await testConnection();
    sendResponse(result);
  } catch (e) {
    sendResponse({ ok: false, error: e.message || String(e) });
  }
}
