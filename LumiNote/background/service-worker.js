/**
 * LumiRead — Background Service Worker (Manifest V3)
 * Handles: API streaming relay, keyboard shortcuts, notebook saves, PDF context tracking.
 */

import { saveEntry, getAllEntries, updateEntry, deleteEntry } from '../lib/notebook.js';
import { createSession, updateSession } from '../lib/moodboard.js';

/* ─── Sub-module imports ──────────────────────────────────────── */

import { initPdfListeners, handleGetPdfContext, handleGetRevisitEntries } from './sw-pdf.js';

import {
  handleCreateMemory,
  handleUpdateMemory,
  handleDeleteMemory,
  handleSearchMemories,
  handleGetMemory,
  handleOpenMemory,
  handleListMoodboardSessions,
  handleGetMoodboardSession,
  handleCreateMoodboardSession,
  handleUpdateMoodboardSession,
  handleDeleteMoodboardSession,
  handleAddMoodboardCard,
  handleRemoveMoodboardCard,
  handleTestConnection,
} from './sw-memory-api.js';

import { handleExplainRequest } from './sw-explain.js';

import {
  ensureContextMenus,
  initContextMenuListeners,
  openImageMarkCard,
  MARK_IMAGE_MENU_ID,
} from './sw-context-menu.js';

/* ─── Keyboard shortcut ─────────────────────────────────────────── */

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'trigger-explain') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'SHORTCUT_TRIGGER' }).catch(() => {});
  }
});

/* ─── Context menus ─────────────────────────────────────────────── */

const ONBOARDING_VERSION = 1;
const ONBOARDING_KEY = 'luminote_onboarding';

chrome.runtime.onInstalled.addListener(async (details) => {
  ensureContextMenus();

  if (details.reason !== 'install' && details.reason !== 'update') return;

  const { [ONBOARDING_KEY]: state = {} } = await chrome.storage.local.get(ONBOARDING_KEY);

  // Migrate existing users: mark onboarding as already "seen" so version upgrades
  // to 1.0.1.3 from an older build don't suddenly surface a welcome deck.
  if (details.reason === 'update' && !state.version) {
    await chrome.storage.local.set({
      [ONBOARDING_KEY]: { version: ONBOARDING_VERSION, completedAt: 0, migrated: true },
    });
    return;
  }

  const shouldShowWelcome =
    details.reason === 'install' ||
    (details.reason === 'update' && (state.version ?? 0) < ONBOARDING_VERSION);

  if (shouldShowWelcome) {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome/welcome.html') });
  }

  // Seed template moodboard on fresh install only.
  if (details.reason === 'install') {
    try {
      const { createTemplateBoard } = await import('../lib/template-board.js');
      const { entries, session } = createTemplateBoard();

      const idMap = {};
      for (const entry of entries) {
        const oldId = entry.id;
        const newId = await saveEntry(entry);
        idMap[oldId] = newId;
      }

      const newSession = await createSession({ name: session.name });
      const remappedCards = session.cards.map((card) => ({
        ...card,
        entryId: idMap[card.entryId] || card.entryId,
      }));
      await updateSession(newSession.id, {
        cards: remappedCards,
        pinned: session.pinned,
        viewport: session.viewport,
      });
    } catch (e) {
      console.warn('[LumiNote] Failed to create template board:', e);
    }
  }
});

chrome.runtime.onStartup.addListener(() => {
  ensureContextMenus(true);
});

ensureContextMenus(true);

/* ─── Init sub-module listeners (must be at top level of SW) ───── */

initContextMenuListeners();
initPdfListeners();

/* ─── Message router ────────────────────────────────────────────── */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXPLAIN_REQUEST') {
    handleExplainRequest(message, { tabId: sender.tab?.id });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'PDF_EXPLAIN_REQUEST') {
    handleExplainRequest(message, { extensionRuntime: true });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'GET_PDF_CONTEXT') {
    handleGetPdfContext(sendResponse);
    return true;
  }

  if (message.type === 'GET_REVISIT_ENTRIES') {
    handleGetRevisitEntries(message, sendResponse);
    return true;
  }

  if (message.type === 'TEST_CONNECTION') {
    handleTestConnection(sendResponse);
    return true;
  }

  if (message.type === 'SAVE_ENTRY') {
    saveEntry(message.entry)
      .then(async (id) => {
        const all = await getAllEntries();
        sendResponse({ ok: true, id, totalCount: all.length });
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error.message || String(error) });
      });
    return true;
  }

  if (message.type === 'UPDATE_ENTRY') {
    updateEntry(message.id, message.updates)
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error.message || String(error) });
      });
    return true;
  }

  if (message.type === 'DELETE_ENTRY') {
    deleteEntry(message.id)
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error.message || String(error) });
      });
    return true;
  }

  if (message.type === 'CAPTURE_SCREENSHOT') {
    const windowId = sender.tab?.windowId;
    if (!sender.tab?.id || windowId == null) {
      sendResponse({ ok: false, error: 'No tab found.' });
      return true;
    }
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' })
      .then((dataUrl) => {
        sendResponse({ ok: true, dataUrl });
      })
      .catch((error) => {
        sendResponse({ ok: false, error: error.message || String(error) });
      });
    return true;
  }

  if (message.type === 'ENSURE_CONTEXT_MENUS') {
    ensureContextMenus(true);
    sendResponse({ ok: true });
    return true;
  }

  /* ─── OpenClaw Memory APIs ─────────────────────────────────────── */

  if (message.type === 'CREATE_MEMORY') {
    handleCreateMemory(message, sendResponse);
    return true;
  }

  if (message.type === 'UPDATE_MEMORY') {
    handleUpdateMemory(message, sendResponse);
    return true;
  }

  if (message.type === 'DELETE_MEMORY') {
    handleDeleteMemory(message, sendResponse);
    return true;
  }

  if (message.type === 'SEARCH_MEMORIES') {
    handleSearchMemories(message, sendResponse);
    return true;
  }

  if (message.type === 'GET_MEMORY') {
    handleGetMemory(message, sendResponse);
    return true;
  }

  if (message.type === 'OPEN_MEMORY') {
    handleOpenMemory(message, sendResponse);
    return true;
  }

  /* ─── OpenClaw Moodboard APIs ──────────────────────────────────── */

  if (message.type === 'LIST_MOODBOARD_SESSIONS') {
    handleListMoodboardSessions(sendResponse);
    return true;
  }

  if (message.type === 'GET_MOODBOARD_SESSION') {
    handleGetMoodboardSession(message, sendResponse);
    return true;
  }

  if (message.type === 'CREATE_MOODBOARD_SESSION') {
    handleCreateMoodboardSession(message, sendResponse);
    return true;
  }

  if (message.type === 'UPDATE_MOODBOARD_SESSION') {
    handleUpdateMoodboardSession(message, sendResponse);
    return true;
  }

  if (message.type === 'DELETE_MOODBOARD_SESSION') {
    handleDeleteMoodboardSession(message, sendResponse);
    return true;
  }

  if (message.type === 'ADD_MOODBOARD_CARD') {
    handleAddMoodboardCard(message, sendResponse);
    return true;
  }

  if (message.type === 'REMOVE_MOODBOARD_CARD') {
    handleRemoveMoodboardCard(message, sendResponse);
    return true;
  }
});

/* ─── MCP WebSocket Bridge ─────────────────────────────────────── *
 * The bridge now lives in the notebook page (notebook.js) instead of
 * the service worker, because MV3 service workers get suspended and
 * drop WebSocket connections. The notebook page stays open and
 * forwards MCP requests via chrome.runtime.sendMessage().
 * ─────────────────────────────────────────────────────────────────── */
