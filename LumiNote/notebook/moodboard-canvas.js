/**
 * moodboard-canvas.js — Canvas engine
 *
 * Owns everything about *how the viewport moves*:
 *   • Pan / zoom transform
 *   • Pointer events on the viewport background (pan, marquee select)
 *   • Wheel zoom (trackpad & mouse)
 *   • Focus-all / animate-pan / step-zoom
 *   • File drop onto canvas (5 MB limit + auto-compress)
 *   • Zoom indicator
 *
 * Does NOT own card rendering, card drag, or resize —
 * those live in moodboard-card.js.
 */

import { $, state } from './moodboard-state.js';
import { processImageFile } from '../lib/image-utils.js';

/* ─── Pointer-event handler refs (for unbind) ────────────────────── */

let _onPointerDown, _onPointerMove, _onPointerUp, _onWheel, _onDragOver, _onDrop;

/* ─── Canvas Transform ───────────────────────────────────────────── */

/**
 * Apply the current panX / panY / zoom to the canvas element
 * and update the viewport grid background.
 */
export function applyTransform() {
  const canvas = $('mb-canvas');
  if (!canvas) return;
  canvas.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;

  const gridSize = 40 * state.zoom;
  const viewport = $('mb-viewport');
  if (viewport) {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const gridColor = isDark ? 'rgba(145,213,177,0.07)' : 'rgba(26,107,74,0.06)';
    viewport.style.backgroundImage =
      `linear-gradient(${gridColor} 1px, transparent 1px),
       linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`;
    viewport.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    viewport.style.backgroundPosition = `${state.panX % gridSize}px ${state.panY % gridSize}px`;
  }
}

/** Update the "120%" zoom percentage label. */
export function updateZoomIndicator() {
  const el = $('mb-zoom-indicator');
  if (el) el.textContent = `${Math.round(state.zoom * 100)}%`;
}

/* ─── Focus / Fit ────────────────────────────────────────────────── */

/**
 * Pan so that the centroid of all cards sits at the viewport centre.
 * @param {Function} [scheduleSave] — called after animation completes
 */
export function focusCards(scheduleSave) {
  if (!state.activeSession || !state.activeSession.cards.length) return;
  const viewport = $('mb-viewport');
  if (!viewport) return;
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const cd of state.activeSession.cards) {
    const w = cd.w || 260;
    const h = cd.h || 220;
    minX = Math.min(minX, cd.x);
    minY = Math.min(minY, cd.y);
    maxX = Math.max(maxX, cd.x + w);
    maxY = Math.max(maxY, cd.y + h);
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const targetPanX = vw / 2 - cx * state.zoom;
  const targetPanY = vh / 2 - cy * state.zoom;

  animatePanTo(targetPanX, targetPanY, state.zoom, scheduleSave);
}

/**
 * Smoothly animate pan+zoom from current values to target values.
 * @param {Function} scheduleSave — called after animation completes
 */
export function animatePanTo(targetX, targetY, targetZoom, scheduleSave) {
  const startX = state.panX, startY = state.panY, startZoom = state.zoom;
  const duration = 320;
  const t0 = performance.now();

  function easeOut(t) { return 1 - (1 - t) ** 3; }

  function step(now) {
    const p = Math.min((now - t0) / duration, 1);
    const e = easeOut(p);
    state.panX = startX + (targetX - startX) * e;
    state.panY = startY + (targetY - startY) * e;
    state.zoom = startZoom + (targetZoom - startZoom) * e;
    applyTransform();
    updateZoomIndicator();
    if (p < 1) requestAnimationFrame(step);
    else if (scheduleSave) scheduleSave();
  }
  requestAnimationFrame(step);
}

/**
 * Zoom in/out by a multiplicative factor, pivoting on the viewport centre.
 * @param {number} factor — e.g. 1.2 for zoom-in, 1/1.2 for zoom-out
 * @param {Function} scheduleSave
 */
export function stepZoom(factor, scheduleSave) {
  const viewport = $('mb-viewport');
  if (!viewport) return;
  const rect = viewport.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const newZoom = Math.min(state.MAX_ZOOM, Math.max(state.MIN_ZOOM, state.zoom * factor));
  state.panX = cx - (cx - state.panX) * (newZoom / state.zoom);
  state.panY = cy - (cy - state.panY) * (newZoom / state.zoom);
  state.zoom = newZoom;
  applyTransform();
  updateZoomIndicator();
  if (scheduleSave) scheduleSave();
}

/* ─── Viewport centre helper ─────────────────────────────────────── */

/** Return canvas-coord centre of the current viewport (for paste / addCard). */
export function viewportCenter() {
  const vp = $('mb-viewport');
  const vw = vp?.clientWidth || 800;
  const vh = vp?.clientHeight || 600;
  return { x: (-state.panX + vw / 2) / state.zoom - 130, y: (-state.panY + vh / 2) / state.zoom - 40 };
}

/* ─── Bind / Unbind viewport events ──────────────────────────────── */

/**
 * Wire up all pointer / wheel / drop events on the viewport.
 * @param {object} callbacks — functions provided by the orchestrator:
 *   • clearSelection()    — clear card selection
 *   • applySelectionVisuals() — refresh selection highlighting
 *   • quickCreateCard(entryData, x, y) — create card from dropped file
 *   • scheduleSave()      — debounced save
 */
export function bindCanvasEvents(callbacks) {
  const viewport = $('mb-viewport');
  if (!viewport) return;
  const { clearSelection, applySelectionVisuals, quickCreateCard, scheduleSave } = callbacks;

  $('mb-zoom-in')?.addEventListener('click', () => stepZoom(1.2, scheduleSave));
  $('mb-zoom-out')?.addEventListener('click', () => stepZoom(1 / 1.2, scheduleSave));

  /* ── Pointer down: pan or marquee ──────────────────────────────── */
  _onPointerDown = (e) => {
    if (e.target.closest('.mb-card')) return;
    if (e.button !== 0) return;

    // Alt+drag on empty canvas → marquee selection
    if (e.altKey) {
      state.isMarquee = true;
      const rect = viewport.getBoundingClientRect();
      state.marqueeStartX = e.clientX - rect.left;
      state.marqueeStartY = e.clientY - rect.top;
      if (!state.marqueeEl) {
        state.marqueeEl = document.createElement('div');
        state.marqueeEl.className = 'mb-marquee';
        viewport.appendChild(state.marqueeEl);
      }
      state.marqueeEl.style.cssText = `left:${state.marqueeStartX}px;top:${state.marqueeStartY}px;width:0;height:0;display:block;`;
      viewport.setPointerCapture(e.pointerId);
      return;
    }

    // Click on empty canvas without Alt → clear selection
    clearSelection();

    state.isPanning = true;
    state.panStartX = e.clientX;
    state.panStartY = e.clientY;
    state.panStartPanX = state.panX;
    state.panStartPanY = state.panY;
    viewport.setPointerCapture(e.pointerId);
    viewport.style.cursor = 'grabbing';
  };

  /* ── Pointer move: pan or marquee ──────────────────────────────── */
  _onPointerMove = (e) => {
    const rect = viewport.getBoundingClientRect();
    state.mouseCanvasX = (e.clientX - rect.left - state.panX) / state.zoom;
    state.mouseCanvasY = (e.clientY - rect.top - state.panY) / state.zoom;

    if (state.isMarquee && state.marqueeEl) {
      const curX = e.clientX - rect.left;
      const curY = e.clientY - rect.top;
      const left = Math.min(state.marqueeStartX, curX);
      const top = Math.min(state.marqueeStartY, curY);
      const w = Math.abs(curX - state.marqueeStartX);
      const h = Math.abs(curY - state.marqueeStartY);
      state.marqueeEl.style.cssText = `left:${left}px;top:${top}px;width:${w}px;height:${h}px;display:block;`;
      return;
    }

    if (state.isPanning) {
      state.panX = state.panStartPanX + (e.clientX - state.panStartX);
      state.panY = state.panStartPanY + (e.clientY - state.panStartY);
      applyTransform();
    }
  };

  /* ── Pointer up: finish pan or marquee ─────────────────────────── */
  _onPointerUp = (e) => {
    if (state.isMarquee) {
      state.isMarquee = false;
      viewport.releasePointerCapture(e.pointerId);
      if (state.marqueeEl) {
        const rect = viewport.getBoundingClientRect();
        const curX = e.clientX - rect.left;
        const curY = e.clientY - rect.top;
        const mLeft = (Math.min(state.marqueeStartX, curX) - state.panX) / state.zoom;
        const mTop = (Math.min(state.marqueeStartY, curY) - state.panY) / state.zoom;
        const mRight = (Math.max(state.marqueeStartX, curX) - state.panX) / state.zoom;
        const mBottom = (Math.max(state.marqueeStartY, curY) - state.panY) / state.zoom;

        if (state.activeSession) {
          for (const cd of state.activeSession.cards) {
            const cLeft = cd.x;
            const cTop = cd.y;
            const cRight = cd.x + (cd.w || 260);
            const cBottom = cd.y + (cd.h || 150);
            // AABB intersection test
            if (cRight >= mLeft && cLeft <= mRight && cBottom >= mTop && cTop <= mBottom) {
              state.selectedCardIds.add(cd.cardId);
            }
          }
          applySelectionVisuals();
        }
        state.marqueeEl.style.display = 'none';
      }
      return;
    }
    if (state.isPanning) {
      state.isPanning = false;
      viewport.releasePointerCapture(e.pointerId);
      viewport.style.cursor = '';
    }
  };

  /* ── Wheel: proportional zoom around cursor ────────────────────── */
  _onWheel = (e) => {
    e.preventDefault();
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 15; // Firefox line mode

    // Clamp delta to avoid huge jumps from fast scroll wheels
    delta = Math.max(-150, Math.min(150, delta));

    const scaleFactor = Math.exp(-delta * 0.0015);
    const newZoom = Math.min(state.MAX_ZOOM, Math.max(state.MIN_ZOOM, state.zoom * scaleFactor));

    const rect = viewport.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    state.panX = mx - (mx - state.panX) * (newZoom / state.zoom);
    state.panY = my - (my - state.panY) * (newZoom / state.zoom);
    state.zoom = newZoom;

    applyTransform();
    updateZoomIndicator();
    scheduleSave();
  };

  /* ── File drop: drag image from OS onto canvas ─────────────────── */
  _onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
  _onDrop = async (e) => {
    e.preventDefault();
    if (!state.activeSession) return;
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (!file) return;

    const rect = viewport.getBoundingClientRect();
    const dropX = (e.clientX - rect.left - state.panX) / state.zoom - 130;
    const dropY = (e.clientY - rect.top - state.panY) / state.zoom - 40;

    const dataUrl = await processImageFile(file);

    await quickCreateCard({
      term: '', note: '', context: '', sourceUrl: '', sourceTitle: '',
      entryType: 'image', imageUrl: dataUrl,
    }, dropX, dropY);
  };

  viewport.addEventListener('pointerdown', _onPointerDown);
  viewport.addEventListener('pointermove', _onPointerMove);
  viewport.addEventListener('pointerup', _onPointerUp);
  viewport.addEventListener('wheel', _onWheel, { passive: false });
  viewport.addEventListener('dragover', _onDragOver);
  viewport.addEventListener('drop', _onDrop);
}

/** Remove all viewport event listeners (called on destroyMoodboard). */
export function unbindCanvasEvents() {
  const viewport = $('mb-viewport');
  if (!viewport) return;
  if (_onPointerDown) viewport.removeEventListener('pointerdown', _onPointerDown);
  if (_onPointerMove) viewport.removeEventListener('pointermove', _onPointerMove);
  if (_onPointerUp) viewport.removeEventListener('pointerup', _onPointerUp);
  if (_onWheel) viewport.removeEventListener('wheel', _onWheel);
  if (_onDragOver) viewport.removeEventListener('dragover', _onDragOver);
  if (_onDrop) viewport.removeEventListener('drop', _onDrop);
}
