/**
 * moodboard-card.js — Card rendering & interaction
 *
 * Owns everything about *individual cards on the canvas*:
 *   • renderCardOnCanvas  — build DOM, wire drag/resize/dblclick
 *   • renderAllCards      — re-render all cards from activeSession
 *   • clearCanvas / updateEmptyHint
 *   • Selection visuals   — clearSelection, applySelectionVisuals
 *   • Image lightbox      — open/close/bind
 *   • Card editor         — openCardEditor (delegates to notebook.js dialog)
 *   • Shared SVG/HTML helpers — textToggleIcon, escapeHtml, truncate
 *
 * Card drag and resize pointer events are bound per-card inside
 * renderCardOnCanvas because each card tracks its own pointer capture.
 */

import { $, state } from './moodboard-state.js';
import { formatTimestamp, getAllEntries } from '../lib/notebook.js';
import { getEntrySourceMeta } from '../lib/source-meta.js';
import { renderMd } from '../lib/render-md.js';
/* ═══════════════════════════════════════════════════════════════════
   Selection helpers
   ═══════════════════════════════════════════════════════════════════ */

export function clearSelection() {
  state.selectedCardIds.clear();
  applySelectionVisuals();
}

/** Toggle CSS class + update export-button tooltip to reflect selection count. */
export function applySelectionVisuals() {
  const canvas = $('mb-canvas');
  if (!canvas) return;
  for (const el of canvas.querySelectorAll('.mb-card')) {
    el.classList.toggle('mb-card--selected', state.selectedCardIds.has(el.dataset.cardId));
  }
  const exportBtn = $('mb-export-png-btn');
  if (exportBtn) {
    exportBtn.title = state.selectedCardIds.size > 0
      ? `Export ${state.selectedCardIds.size} selected cards as PNG`
      : 'Export as PNG';
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Card rendering
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Create one card DOM element on the canvas and wire all its interactions
 * (drag, resize, dblclick-edit, delete, text-toggle).
 *
 * @param {object} cardData — { cardId, entryId, x, y, w?, h?, textHidden? }
 * @param {object} entry    — memory entry object
 * @param {object} callbacks — from orchestrator:
 *   • pushUndo()
 *   • scheduleSave()
 *   • updateEmptyHint()
 *   • renderSessionList()
 */
export function renderCardOnCanvas(cardData, entry, callbacks) {
  const { pushUndo, scheduleSave, updateEmptyHint, renderSessionList } = callbacks;
  const canvas = $('mb-canvas');
  if (!canvas) return;

  const el = document.createElement('div');
  el.className = 'mb-card';
  el.dataset.cardId = cardData.cardId;
  el.style.left = `${cardData.x}px`;
  el.style.top = `${cardData.y}px`;

  // Restore persisted size
  if (cardData.w) el.style.width = `${cardData.w}px`;
  if (cardData.h) {
    el.style.height = `${cardData.h}px`;
    el.classList.add('mb-card--sized');
  }
  if (cardData.textHidden) el.classList.add('mb-card--text-hidden');

  const isImage = entry.entryType === 'image';
  const snippet = entry.note || entry.aiSummary || entry.context || '';
  const hasImage = isImage && entry.imageUrl;
  const imageHtml = hasImage
    ? `<img class="mb-card__image" src="${escapeHtml(entry.imageUrl)}" alt="" loading="lazy" draggable="false">`
    : '';

  el.innerHTML = `
    <button class="mb-card__delete" title="Remove from board" type="button">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
    ${hasImage ? `
    <button class="mb-card__text-toggle${cardData.textHidden ? '' : ' mb-card__text-toggle--active'}"
            title="${cardData.textHidden ? 'Show text' : 'Hide text'}" type="button">
      ${textToggleIcon(!cardData.textHidden)}
    </button>` : ''}
    ${imageHtml}
    <div class="mb-card__header">
      <div class="mb-card__type-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${isImage
            ? '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>'
            : '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'}
        </svg>
      </div>
      <div class="mb-card__title">${escapeHtml(entry.term || 'Untitled')}</div>
    </div>
    ${snippet ? `<div class="mb-card__body">${renderMd(snippet)}</div>` : ''}
    <div class="mb-card__footer">
      ${(() => {
        if (!entry.sourceUrl) return `
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          ${escapeHtml(formatTimestamp(entry.timestamp))}`;
        const sm = getEntrySourceMeta(entry);
        const label = sm.pageLabel ? `${sm.label} · ${sm.pageLabel}` : sm.label;
        return `<a class="mb-card__source-link" href="${escapeHtml(sm.href)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(sm.title)}">${escapeHtml(label)}</a>
          <span class="mb-card__footer-sep">·</span>
          ${escapeHtml(formatTimestamp(entry.timestamp))}`;
      })()}
    </div>
    <div class="mb-resize-handle" title="Drag to resize · Double-click to reset"></div>
  `;

  /* ── Delete button ─────────────────────────────────────────────── */
  el.querySelector('.mb-card__delete').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!state.activeSession) return;
    pushUndo();
    state.activeSession.cards = state.activeSession.cards.filter((c) => c.cardId !== cardData.cardId);
    el.remove();
    updateEmptyHint();
    scheduleSave();
    const s = state.sessions.find((x) => x.id === state.activeSession.id);
    if (s) s.cards = state.activeSession.cards;
    renderSessionList();
    // B5: surface the existing Ctrl+Z undo path via a toast — users didn't
    // know the board already supports undo. notebook.js owns the toast fn.
    if (typeof window !== 'undefined' && typeof window.__luminote_showUndoToast === 'function') {
      window.__luminote_showUndoToast('Card removed — Cmd/Ctrl+Z to undo', null);
    }
  });

  /* ── Text toggle (image cards only) ────────────────────────────── */
  el.querySelector('.mb-card__text-toggle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const cd = state.activeSession?.cards.find((c) => c.cardId === cardData.cardId);
    if (!cd) return;
    pushUndo();
    cd.textHidden = !cd.textHidden;
    el.classList.toggle('mb-card--text-hidden', cd.textHidden);
    const btn = e.currentTarget;
    btn.title = cd.textHidden ? 'Show text' : 'Hide text';
    btn.classList.toggle('mb-card__text-toggle--active', !cd.textHidden);
    btn.innerHTML = textToggleIcon(!cd.textHidden);
    scheduleSave();
  });

  // Source link: stop propagation so it doesn't trigger card open
  el.querySelector('.mb-card__source-link')?.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  /* ── Resize handle ─────────────────────────────────────────────── */
  const resizeHandle = el.querySelector('.mb-resize-handle');
  let isResizing = false;
  let resizePid = 0;
  let resizeStartX = 0, resizeStartY = 0;
  let resizeStartW = 0, resizeStartH = 0;

  resizeHandle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    pushUndo();
    isResizing = true;
    resizePid = e.pointerId;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    resizeStartW = el.offsetWidth;
    resizeStartH = el.offsetHeight;
    resizeHandle.setPointerCapture(e.pointerId);
  });

  resizeHandle.addEventListener('pointermove', (e) => {
    if (!isResizing) return;
    const dx = (e.clientX - resizeStartX) / state.zoom;
    const dy = (e.clientY - resizeStartY) / state.zoom;
    const newW = Math.max(160, resizeStartW + dx);
    const newH = Math.max(80, resizeStartH + dy);

    const cd = state.activeSession?.cards.find((c) => c.cardId === cardData.cardId);
    if (cd) {
      cd.w = newW;
      cd.h = newH;
      el.style.width = `${newW}px`;
      el.style.height = `${newH}px`;
      el.classList.add('mb-card--sized');
    }
  });

  resizeHandle.addEventListener('pointerup', () => {
    if (!isResizing) return;
    isResizing = false;
    resizeHandle.releasePointerCapture(resizePid);
    scheduleSave();
  });

  // Double-click handle to reset card to auto size
  resizeHandle.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const cd = state.activeSession?.cards.find((c) => c.cardId === cardData.cardId);
    if (cd) {
      pushUndo();
      delete cd.w;
      delete cd.h;
      el.style.width = '';
      el.style.height = '';
      el.classList.remove('mb-card--sized');
      scheduleSave();
    }
  });

  /* ── Double-click to open editor / lightbox ────────────────────── */
  el.addEventListener('dblclick', (e) => {
    if (e.target.closest('.mb-card__delete')) return;
    if (e.target.closest('.mb-card__text-toggle')) return;
    if (e.target.closest('.mb-resize-handle')) return;
    if (e.target.closest('.mb-card__image') && entry.imageUrl) {
      openLightbox(entry.imageUrl);
    } else {
      openCardEditor(cardData, entry, el);
    }
  });

  /* ── Card drag (single & multi) ────────────────────────────────── */
  let cardPointerDown = false;
  let cardMoved = false;
  let cardPid = 0;
  let cardDownX = 0, cardDownY = 0;

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.mb-card__delete')) return;
    if (e.target.closest('.mb-card__text-toggle')) return;
    if (e.target.closest('.mb-resize-handle')) return;
    e.stopPropagation();

    // Alt+click toggles selection
    if (e.altKey) {
      if (state.selectedCardIds.has(cardData.cardId)) {
        state.selectedCardIds.delete(cardData.cardId);
      } else {
        state.selectedCardIds.add(cardData.cardId);
      }
      applySelectionVisuals();
    } else if (!state.selectedCardIds.has(cardData.cardId)) {
      clearSelection();
    }

    cardPointerDown = true;
    cardMoved = false;
    cardPid = e.pointerId;
    cardDownX = e.clientX;
    cardDownY = e.clientY;

    // Snapshot start positions for this card and all selected cards
    const cd = state.activeSession?.cards.find((c) => c.cardId === cardData.cardId);
    state.dragCardStartX = cd?.x || 0;
    state.dragCardStartY = cd?.y || 0;
    el._multiDragStarts = new Map();
    if (state.selectedCardIds.has(cardData.cardId) && state.selectedCardIds.size > 1) {
      for (const cid of state.selectedCardIds) {
        const c = state.activeSession?.cards.find((cc) => cc.cardId === cid);
        if (c) el._multiDragStarts.set(cid, { x: c.x, y: c.y });
      }
    }
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', (e) => {
    if (!cardPointerDown) return;
    const dx = e.clientX - cardDownX;
    const dy = e.clientY - cardDownY;

    if (!cardMoved && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      pushUndo();
      cardMoved = true;
      state.draggingCard = el;
      state.dragStartX = cardDownX;
      state.dragStartY = cardDownY;
      el.classList.add('mb-card--dragging');
      el.style.cursor = 'grabbing';
    }

    if (cardMoved) {
      const cdx = (e.clientX - state.dragStartX) / state.zoom;
      const cdy = (e.clientY - state.dragStartY) / state.zoom;

      // Multi-drag: move all selected cards together
      if (el._multiDragStarts && el._multiDragStarts.size > 1) {
        const canvasEl = $('mb-canvas');
        for (const [cid, start] of el._multiDragStarts) {
          const c = state.activeSession?.cards.find((cc) => cc.cardId === cid);
          if (!c) continue;
          c.x = start.x + cdx;
          c.y = start.y + cdy;
          const cel = canvasEl?.querySelector(`.mb-card[data-card-id="${cid}"]`);
          if (cel) { cel.style.left = `${c.x}px`; cel.style.top = `${c.y}px`; }
        }
      } else {
        const cd = state.activeSession?.cards.find((c) => c.cardId === cardData.cardId);
        if (cd) {
          cd.x = state.dragCardStartX + cdx;
          cd.y = state.dragCardStartY + cdy;
          el.style.left = `${cd.x}px`;
          el.style.top = `${cd.y}px`;
        }
      }
    }
  });

  el.addEventListener('pointerup', (e) => {
    if (!cardPointerDown) return;
    cardPointerDown = false;
    el.releasePointerCapture(cardPid);

    if (cardMoved) {
      el.classList.remove('mb-card--dragging');
      el.style.cursor = '';
      state.draggingCard = null;
      scheduleSave();
    }
  });

  canvas.appendChild(el);
}

/* ═══════════════════════════════════════════════════════════════════
   Bulk rendering helpers
   ═══════════════════════════════════════════════════════════════════ */

/** Re-render every card in the active session. */
export function renderAllCards(callbacks) {
  if (!state.activeSession) return;
  for (const cd of state.activeSession.cards) {
    const entry = state.allMemoryEntries.find((en) => en.id === cd.entryId);
    if (entry) renderCardOnCanvas(cd, entry, callbacks);
  }
  updateEmptyHint();
}

export function clearCanvas() {
  const canvas = $('mb-canvas');
  if (canvas) canvas.innerHTML = '';
}

export function updateEmptyHint() {
  const hint = $('mb-empty-hint');
  if (!hint) return;
  const hasCards = state.activeSession?.cards.length > 0;
  hint.style.display = hasCards ? 'none' : '';
}

/* ═══════════════════════════════════════════════════════════════════
   Image Lightbox
   ═══════════════════════════════════════════════════════════════════ */

export function bindLightbox() {
  $('mb-lightbox-close')?.addEventListener('click', closeLightbox);
  $('mb-lightbox-backdrop')?.addEventListener('click', closeLightbox);
}

function openLightbox(src) {
  const lb = $('mb-lightbox');
  const img = $('mb-lightbox-img');
  if (!lb || !img) return;
  img.src = src;
  lb.style.display = 'flex';
  document.addEventListener('keydown', onLightboxEsc);
}

function closeLightbox() {
  const lb = $('mb-lightbox');
  if (!lb) return;
  lb.style.display = 'none';
  document.removeEventListener('keydown', onLightboxEsc);
}

function onLightboxEsc(e) {
  if (e.key === 'Escape') closeLightbox();
}

/* ═══════════════════════════════════════════════════════════════════
   Card Editor (delegates to notebook.js edit dialog)
   ═══════════════════════════════════════════════════════════════════ */

async function openCardEditor(cardData, entry, cardEl) {
  const { openEditMemoryDialog } = await import('./notebook.js');
  openEditMemoryDialog(entry);

  const dialog = document.getElementById('edit-memory-dialog');
  if (!dialog) return;

  dialog.addEventListener('close', async () => {
    const entries = await getAllEntries();
    const updated = entries.find((e) => e.id === entry.id);
    if (!updated) return;
    Object.assign(entry, updated);
    if (cardEl.parentElement) {
      cardEl.remove();
      // Re-render needs callbacks — use a minimal set from state
      renderCardOnCanvas(cardData, entry, _lastCallbacks);
    }
  }, { once: true });
}

/** Stash most recent callbacks so the card-editor close handler can re-render. */
let _lastCallbacks = null;
export function setCallbacks(cb) { _lastCallbacks = cb; }

/* ═══════════════════════════════════════════════════════════════════
   Shared HTML / SVG helpers (also used by moodboard.js search popup)
   ═══════════════════════════════════════════════════════════════════ */

function textToggleIcon(textVisible) {
  if (textVisible) {
    return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="16" y2="12"/>
      <line x1="3" y1="18" x2="19" y2="18"/>
    </svg>`;
  } else {
    return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="16" y2="12"/>
      <line x1="3" y1="18" x2="19" y2="18"/>
      <line x1="1" y1="23" x2="23" y2="1"/>
    </svg>`;
  }
}

export function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}
