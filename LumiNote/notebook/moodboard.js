/**
 * LumiNote — Moodboard Orchestrator
 *
 * This is the top-level module that wires together all moodboard sub-modules:
 *
 *   moodboard-state.js   — centralised shared state
 *   moodboard-canvas.js  — viewport pan/zoom/wheel/focus
 *   moodboard-card.js    — card DOM rendering, drag, resize, selection, lightbox
 *   moodboard-export.js  — PNG export pipeline
 *
 * This file owns:
 *   • init / destroy lifecycle
 *   • Session list (sidebar) rendering, load/save, storage sync
 *   • Agent mutation listener (MCP → refresh board)
 *   • Keyboard bindings (dispatch to sub-modules)
 *   • Blueprint search popup
 *   • Board bar (rename + create-note + export buttons)
 *   • Public API (getActiveSession, getSelectedCardIds, addCardById, createNewSession)
 */

import { $, state } from './moodboard-state.js';
import { getAllSessions, getSession, createSession, updateSession, deleteSession, generateCardId } from '../lib/moodboard.js';
import { searchEntries, getAllEntries, saveEntry, formatTimestamp } from '../lib/notebook.js';
import { getCapability } from '../lib/plan.js';
/* ── Sub-module imports ──────────────────────────────────────────── */
import { applyTransform, updateZoomIndicator, focusCards, stepZoom, viewportCenter, bindCanvasEvents, unbindCanvasEvents } from './moodboard-canvas.js';
import { renderCardOnCanvas, renderAllCards, clearCanvas, updateEmptyHint, clearSelection, applySelectionVisuals, bindLightbox, escapeHtml, truncate, setCallbacks as setCardCallbacks } from './moodboard-card.js';
import { exportCanvasAsPng } from './moodboard-export.js';
import { processImageFile } from '../lib/image-utils.js';

/* ═══════════════════════════════════════════════════════════════════
   Callback bags — passed to sub-modules so they can call back here
   ═══════════════════════════════════════════════════════════════════ */

/** Callbacks for moodboard-card.js renderCardOnCanvas */
const cardCallbacks = {
  pushUndo,
  scheduleSave,
  updateEmptyHint,
  renderSessionList,
};

/** Callbacks for moodboard-canvas.js */
const canvasCallbacks = {
  clearSelection,
  applySelectionVisuals,
  quickCreateCard,
  scheduleSave,
};

/* ═══════════════════════════════════════════════════════════════════
   Init / Destroy
   ═══════════════════════════════════════════════════════════════════ */

export async function initMoodboard() {
  state.sessions = await getAllSessions();
  state.allMemoryEntries = await getAllEntries();

  // Pass callback bag to card module so editor-close can re-render
  setCardCallbacks(cardCallbacks);

  renderSessionList();
  bindCanvasEvents(canvasCallbacks);
  bindKeyboard();
  bindBoardBar();
  bindClickOutside();
  bindLightbox();
  bindAgentMutation();
  bindStorageSync();

  // Load the most recent session
  if (state.sessions.length > 0) {
    await loadSession(state.sessions[0].id);
  }

}

export function destroyMoodboard() {
  saveCurrentSession();
  unbindCanvasEvents();
  unbindKeyboard();
  unbindClickOutside();
  unbindAgentMutation();
  unbindStorageSync();
  clearCanvas();
}

/* ═══════════════════════════════════════════════════════════════════
   Agent mutation listener — refresh board when agent modifies data
   ═══════════════════════════════════════════════════════════════════ */

let _agentMutationHandler = null;

function bindAgentMutation() {
  _agentMutationHandler = async (e) => {
    const { tool } = e.detail || {};
    if (tool === 'add_moodboard_card' || tool === 'remove_moodboard_card') {
      if (state.activeSession) {
        await reloadSessionFromStorage(state.activeSession.id);
      }
    } else if (tool === 'create_moodboard_session' || tool === 'delete_moodboard_session' || tool === 'update_moodboard_session') {
      state.sessions = await getAllSessions();
      renderSessionList();
      if (tool === 'delete_moodboard_session' && state.activeSession) {
        const remaining = state.sessions.filter((s) => s.id !== state.activeSession.id);
        if (remaining.length) {
          await reloadSessionFromStorage(remaining[0].id);
        } else {
          state.activeSession = null;
          clearCanvas();
          updateEmptyHint();
        }
      }
    }
  };
  window.addEventListener('luminote-agent-mutation', _agentMutationHandler);
}

function unbindAgentMutation() {
  if (_agentMutationHandler) {
    window.removeEventListener('luminote-agent-mutation', _agentMutationHandler);
    _agentMutationHandler = null;
  }
}

/** Reload a session from storage WITHOUT saving current in-memory state first. */
async function reloadSessionFromStorage(id) {
  const session = await getSession(id);
  if (!session) return;

  state.activeSession = session;
  state.panX = session.viewport?.x || 0;
  state.panY = session.viewport?.y || 0;
  state.zoom = session.viewport?.zoom || 1;

  state.allMemoryEntries = await getAllEntries();
  clearCanvas();
  applyTransform();
  updateZoomIndicator();
  updateBoardBar();

  for (const cardData of session.cards) {
    const entry = state.allMemoryEntries.find((e) => e.id === cardData.entryId);
    if (!entry) continue;
    renderCardOnCanvas(cardData, entry, cardCallbacks);
  }

  updateEmptyHint();
  renderSessionList();
}

/* ═══════════════════════════════════════════════════════════════════
   Session List (Sidebar)
   ═══════════════════════════════════════════════════════════════════ */

function renderSessionList() {
  const list = $('mb-sessions-list');
  if (!list) return;

  list.innerHTML = '';
  const sorted = [...state.sessions].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  for (const s of sorted) {
    const card = document.createElement('div');
    card.className = `mb-session-card${state.activeSession?.id === s.id ? ' mb-session-card--active' : ''}`;
    card.dataset.sessionId = s.id;

    const pinned = s.pinned;
    card.innerHTML = `
      <div class="mb-session-card__icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      </div>
      <div class="mb-session-card__info">
        <div class="mb-session-card__name">${escapeHtml(s.name)}</div>
      </div>
      ${''}
      <button class="mb-session-card__pin${pinned ? ' mb-session-card__pin--active' : ''}" title="${pinned ? 'Unpin' : 'Pin to top'}" type="button">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 2l0 10"/><path d="M8 6l8 0"/><path d="M15.5 6l1 6H7.5l1-6"/><path d="M12 12l0 10"/>
        </svg>
      </button>
      <button class="mb-session-card__delete" title="Delete board" type="button">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.mb-session-card__delete') || e.target.closest('.mb-session-card__pin')) return;
      // Dispatch event so notebook.js can handle view switching before loading
      window.dispatchEvent(new CustomEvent('luminote-open-board', { detail: { sessionId: s.id } }));
    });

    card.querySelector('.mb-session-card__pin').addEventListener('click', async (e) => {
      e.stopPropagation();
      s.pinned = !s.pinned;
      await updateSession(s.id, { pinned: s.pinned });
      renderSessionList();
    });

    card.querySelector('.mb-session-card__delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete "${s.name}"?`)) return;
      await deleteSession(s.id);
      state.sessions = state.sessions.filter((x) => x.id !== s.id);
      if (state.activeSession?.id === s.id) {
        state.activeSession = null;
        clearCanvas();
        if (state.sessions.length > 0) {
          await loadSession(state.sessions[0].id);
        }
      }
      renderSessionList();
    });

    list.appendChild(card);
  }
}

export async function createNewSession(name) {
  // Board count is unlimited in this build; getCapability returns Infinity.
  const limit = await getCapability('maxBoards');
  if (limit !== Infinity) {
    const allSessions = await getAllSessions();
    if (allSessions.length >= limit) {
      alert(`This build allows up to ${limit} boards.`);
      return null;
    }
  }

  const session = await createSession({ name: name || 'Untitled Board' });
  state.sessions.unshift(session);
  await loadSession(session.id);
  renderSessionList();
  return session;
}

/* ═══════════════════════════════════════════════════════════════════
   Load / Save Session
   ═══════════════════════════════════════════════════════════════════ */

async function loadSession(id) {
  await saveCurrentSession();
  clearSelection();
  state.undoStack.length = 0;

  const session = await getSession(id);
  if (!session) return;

  state.activeSession = session;
  state.panX = session.viewport?.x || 0;
  state.panY = session.viewport?.y || 0;
  state.zoom = session.viewport?.zoom || 1;

  state.allMemoryEntries = await getAllEntries();
  clearCanvas();
  applyTransform();
  updateZoomIndicator();
  updateBoardBar();

  for (const cardData of session.cards) {
    const entry = state.allMemoryEntries.find((e) => e.id === cardData.entryId);
    if (!entry) continue;
    renderCardOnCanvas(cardData, entry, cardCallbacks);
  }

  updateEmptyHint();
  renderSessionList();
}

function saveCurrentSession() {
  if (!state.activeSession) return;
  state._lastSaveTime = Date.now();
  return updateSession(state.activeSession.id, {
    viewport: { x: state.panX, y: state.panY, zoom: state.zoom },
    cards: state.activeSession.cards,
  });
}

function scheduleSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => saveCurrentSession(), 500);
}

/* ═══════════════════════════════════════════════════════════════════
   Storage sync — detect external writes (e.g. from MCP server)
   ═══════════════════════════════════════════════════════════════════ */

function bindStorageSync() {
  state._storageListener = (changes, area) => {
    if (area !== 'local' || !changes.luminote_moodboard_sessions) return;
    if (!state.activeSession) return;
    if (Date.now() - state._lastSaveTime < 500) return;

    const newSessions = changes.luminote_moodboard_sessions.newValue || [];
    const updated = newSessions.find((s) => s.id === state.activeSession.id);
    if (!updated) return;

    clearTimeout(state.saveTimer);
    state.saveTimer = null;
    reloadSessionFromStorage(state.activeSession.id);
  };
  chrome.storage.onChanged.addListener(state._storageListener);
}

function unbindStorageSync() {
  if (state._storageListener) {
    chrome.storage.onChanged.removeListener(state._storageListener);
    state._storageListener = null;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Quick-create helper (shared by drop / paste / addCardById)
   ═══════════════════════════════════════════════════════════════════ */

async function quickCreateCard(entryData, x, y) {
  if (!state.activeSession) return;
  pushUndo();
  const newId = await saveEntry(entryData);
  state.allMemoryEntries = await getAllEntries();
  const entry = state.allMemoryEntries.find((en) => en.id === newId);
  if (!entry) return;

  const cardData = { cardId: generateCardId(), entryId: newId, x, y };
  state.activeSession.cards.push(cardData);
  renderCardOnCanvas(cardData, entry, cardCallbacks);
  updateEmptyHint();
  scheduleSave();
  const s = state.sessions.find((sx) => sx.id === state.activeSession.id);
  if (s) s.cards = state.activeSession.cards;
  renderSessionList();
}

/* ═══════════════════════════════════════════════════════════════════
   Undo helpers
   ═══════════════════════════════════════════════════════════════════ */

function pushUndo() {
  if (!state.activeSession) return;
  const snapshot = JSON.parse(JSON.stringify(state.activeSession.cards));
  state.undoStack.push(snapshot);
  if (state.undoStack.length > state.UNDO_LIMIT) state.undoStack.shift();
}

function performUndo() {
  if (!state.activeSession || state.undoStack.length === 0) return;
  const snapshot = state.undoStack.pop();
  state.activeSession.cards = snapshot;
  const s = state.sessions.find((sx) => sx.id === state.activeSession.id);
  if (s) s.cards = state.activeSession.cards;
  clearSelection();
  clearCanvas();
  renderAllCards(cardCallbacks);
  renderSessionList();
  scheduleSave();
}

/* ═══════════════════════════════════════════════════════════════════
   Keyboard (C key search, F focus, Ctrl+Z undo, Delete, paste)
   ═══════════════════════════════════════════════════════════════════ */

let _onKeyDown, _onPaste;

function bindKeyboard() {
  _onKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (state.selectedCardIds.size > 0) { clearSelection(); return; }
      hideSearchPopup();
      return;
    }

    // F key focuses all cards
    if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      if ($('moodboard-view')?.style.display === 'none') return;
      focusCards(scheduleSave);
      return;
    }

    // Ctrl+Z / Cmd+Z undo
    if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      if ($('moodboard-view')?.style.display === 'none') return;
      e.preventDefault();
      performUndo();
      return;
    }

    // Delete / Backspace removes selected cards
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      if ($('moodboard-view')?.style.display === 'none') return;
      if (!state.activeSession || state.selectedCardIds.size === 0) return;
      e.preventDefault();
      pushUndo();
      const canvas = $('mb-canvas');
      const deletedIds = [...state.selectedCardIds];
      for (const cid of state.selectedCardIds) {
        state.activeSession.cards = state.activeSession.cards.filter((c) => c.cardId !== cid);
        canvas?.querySelector(`.mb-card[data-card-id="${cid}"]`)?.remove();
      }
      const s = state.sessions.find((sx) => sx.id === state.activeSession.id);
      if (s) s.cards = state.activeSession.cards;
      clearSelection();
      updateEmptyHint();
      renderSessionList();
      scheduleSave();
      return;
    }

    // C key opens search
    if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      if ($('moodboard-view')?.style.display === 'none') return;
      if (!state.activeSession) return;
      e.preventDefault();
      showSearchPopup();
    }
  };

  _onPaste = async (e) => {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
    if ($('moodboard-view')?.style.display === 'none') return;
    if (!state.activeSession) return;

    const items = [...(e.clipboardData?.items || [])];
    const { x, y } = viewportCenter();

    // Priority 1: image
    const imgItem = items.find((it) => it.type.startsWith('image/'));
    if (imgItem) {
      e.preventDefault();
      const file = imgItem.getAsFile();
      if (!file) return;
      const dataUrl = await processImageFile(file);
      await quickCreateCard({
        term: '', note: '', context: '', sourceUrl: '', sourceTitle: '',
        entryType: 'image', imageUrl: dataUrl,
      }, x, y);
      return;
    }

    // Priority 2: plain text
    const text = e.clipboardData?.getData('text/plain')?.trim();
    if (text) {
      e.preventDefault();
      await quickCreateCard({
        term: '', note: text, context: '', sourceUrl: '', sourceTitle: '',
      }, x, y);
    }
  };

  document.addEventListener('keydown', _onKeyDown);
  document.addEventListener('paste', _onPaste);
}

function unbindKeyboard() {
  if (_onKeyDown) document.removeEventListener('keydown', _onKeyDown);
  if (_onPaste) document.removeEventListener('paste', _onPaste);
}

/* ═══════════════════════════════════════════════════════════════════
   Blueprint Search Popup
   ═══════════════════════════════════════════════════════════════════ */

function showSearchPopup() {
  const popup = $('mb-search-popup');
  const viewport = $('mb-viewport');
  if (!popup || !viewport) return;

  const rect = viewport.getBoundingClientRect();
  popup.style.left = `${rect.width / 2 - 160}px`;
  popup.style.top = `${rect.height / 2 - 100}px`;
  popup.style.display = '';

  const input = $('mb-search-input');
  input.value = '';
  input.focus();
  renderSearchResults('');
  input.oninput = () => renderSearchResults(input.value);
}

function hideSearchPopup() {
  const popup = $('mb-search-popup');
  if (popup) popup.style.display = 'none';
}

async function renderSearchResults(query) {
  const results = $('mb-search-results');
  if (!results) return;

  const entries = query.trim()
    ? await searchEntries(query)
    : await getAllEntries();

  const limited = entries.slice(0, 30);

  if (limited.length === 0) {
    results.innerHTML = '<div class="mb-search-empty">No memories found</div>';
    return;
  }

  results.innerHTML = '';
  for (const entry of limited) {
    const alreadyOnCanvas = state.activeSession?.cards.some((c) => c.entryId === entry.id);

    const item = document.createElement('div');
    item.className = 'mb-search-item';
    if (alreadyOnCanvas) item.style.opacity = '0.4';

    const isImage = entry.entryType === 'image';
    const snippet = entry.note || entry.aiSummary || entry.context || '';

    item.innerHTML = `
      <div class="mb-search-item__icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${isImage
            ? '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'
            : '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'}
        </svg>
      </div>
      <div class="mb-search-item__text">
        <div class="mb-search-item__title">${escapeHtml(entry.term || 'Untitled')}</div>
        <div class="mb-search-item__snippet">${escapeHtml(truncate(snippet, 60))}</div>
      </div>
    `;

    item.addEventListener('click', () => {
      if (alreadyOnCanvas) return;
      placeCardFromEntry(entry);
      hideSearchPopup();
    });

    results.appendChild(item);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Card Placement (from search popup)
   ═══════════════════════════════════════════════════════════════════ */

function placeCardFromEntry(entry) {
  if (!state.activeSession) return;

  const cardData = {
    cardId: generateCardId(),
    entryId: entry.id,
    x: state.mouseCanvasX - 130,
    y: state.mouseCanvasY - 40,
  };

  state.activeSession.cards.push(cardData);
  renderCardOnCanvas(cardData, entry, cardCallbacks);
  updateEmptyHint();
  scheduleSave();
  const s = state.sessions.find((x) => x.id === state.activeSession.id);
  if (s) s.cards = state.activeSession.cards;
  renderSessionList();
}

/* ═══════════════════════════════════════════════════════════════════
   Board Bar (rename + buttons)
   ═══════════════════════════════════════════════════════════════════ */

function bindBoardBar() {
  const renameBtn = $('mb-board-rename-btn');
  if (!renameBtn) return;
  renameBtn.onclick = async () => {
    if (!state.activeSession) return;
    const newName = prompt('Board name:', state.activeSession.name);
    if (newName === null || !newName.trim()) return;
    state.activeSession.name = newName.trim();
    await updateSession(state.activeSession.id, { name: state.activeSession.name });
    const s = state.sessions.find((x) => x.id === state.activeSession.id);
    if (s) s.name = state.activeSession.name;
    updateBoardBar();
    renderSessionList();
  };

  $('mb-create-note-btn')?.addEventListener('click', async () => {
    const { openCreateNoteDialog } = await import('./notebook.js');
    openCreateNoteDialog();
  });

  $('mb-export-png-btn')?.addEventListener('click', () => exportCanvasAsPng());
}

function updateBoardBar() {
  const bar = $('mb-board-bar');
  const nameEl = $('mb-board-name');
  if (!bar || !nameEl) return;
  if (state.activeSession) {
    bar.style.display = '';
    nameEl.textContent = state.activeSession.name;
  } else {
    bar.style.display = 'none';
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Click-outside to close search
   ═══════════════════════════════════════════════════════════════════ */

let _onClickOutside;

function bindClickOutside() {
  _onClickOutside = (e) => {
    const popup = $('mb-search-popup');
    if (!popup || popup.style.display === 'none') return;
    if (!popup.contains(e.target)) {
      hideSearchPopup();
    }
  };
  document.addEventListener('pointerdown', _onClickOutside);
}

function unbindClickOutside() {
  if (_onClickOutside) document.removeEventListener('pointerdown', _onClickOutside);
}

/* ═══════════════════════════════════════════════════════════════════
   Public API — consumed by notebook.js and agent-chat.js
   ═══════════════════════════════════════════════════════════════════ */

export function getActiveSession() { return state.activeSession; }
export function getSelectedCardIds() { return [...state.selectedCardIds]; }

/**
 * Add a newly-created memory entry to the active moodboard session.
 * Places the card at the viewport centre.
 */
export async function addCardById(entryId) {
  if (!state.activeSession) return;
  pushUndo();

  state.allMemoryEntries = await getAllEntries();
  const entry = state.allMemoryEntries.find((e) => e.id === entryId);
  if (!entry) return;

  const { x, y } = viewportCenter();
  const cardData = {
    cardId: generateCardId(),
    entryId,
    x, y,
  };

  state.activeSession.cards.push(cardData);
  renderCardOnCanvas(cardData, entry, cardCallbacks);
  updateEmptyHint();
  scheduleSave();
  const s = state.sessions.find((x) => x.id === state.activeSession.id);
  if (s) s.cards = state.activeSession.cards;
  renderSessionList();
}

/* ── Legacy named exports for backward compatibility with notebook.js ─ */
export { loadSession, renderSessionList };
export { state };
