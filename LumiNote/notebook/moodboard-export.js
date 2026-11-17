/**
 * moodboard-export.js — PNG export
 *
 * Exports the entire board (or only selected cards) as a high-DPI PNG.
 *
 * Pipeline:
 *   1. Calculate bounding box of cards to export
 *   2. Clone cards into an off-screen container (solid bg fallback for glass)
 *   3. Render via html2canvas
 *   4. Composite: rendered canvas + corner branding
 *   5. Trigger browser download
 *
 * Dark-mode aware — detects `prefers-color-scheme: dark` and adjusts colours.
 */

import { $, state } from './moodboard-state.js';

/**
 * Export the active session's canvas as a PNG image.
 * If cards are selected, only those cards are exported. Exports are clean —
 * the only addition is non-obstructive corner branding.
 */
export async function exportCanvasAsPng() {
  if (!state.activeSession || !state.activeSession.cards.length) return;

  const btn = $('mb-export-png-btn');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }

  try {
    const canvas = $('mb-canvas');
    if (!canvas) return;

    // Export only selected cards if there's a selection, otherwise all cards
    const cardsToExport = state.selectedCardIds.size > 0
      ? state.activeSession.cards.filter(c => state.selectedCardIds.has(c.cardId))
      : state.activeSession.cards;
    if (!cardsToExport.length) return;

    /* ── 1. Bounding box ───────────────────────────────────────────── */
    const PAD = 60;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const cd of cardsToExport) {
      const el = canvas.querySelector(`.mb-card[data-card-id="${cd.cardId}"]`);
      const w = el?.offsetWidth || cd.w || 260;
      const h = el?.offsetHeight || cd.h || 200;
      minX = Math.min(minX, cd.x);
      minY = Math.min(minY, cd.y);
      maxX = Math.max(maxX, cd.x + w);
      maxY = Math.max(maxY, cd.y + h);
    }

    // Reserve space for the corner branding below the cards
    const wmFontEst = Math.max(36, Math.min(80, (maxX - minX + PAD * 2) * 2 * 0.045));
    const wmReserve = Math.ceil(wmFontEst * 0.04 * 22 + 20);
    const bottomPad = Math.max(PAD, wmReserve);

    const bboxW = maxX - minX + PAD * 2;
    const bboxH = maxY - minY + PAD + bottomPad;

    /* ── 2. Off-screen container with cloned cards ─────────────────── */
    const container = document.createElement('div');
    container.style.cssText = `
      position:fixed; left:-99999px; top:0;
      width:${bboxW}px; height:${bboxH}px;
      background:#f3f6f4; overflow:hidden;
    `;

    const isDark = window.matchMedia('(prefers-color-scheme:dark)').matches
      || document.documentElement.classList.contains('dark');
    if (isDark) container.style.background = '#1a1f1c';

    // Grid pattern (matches the live canvas grid)
    const gridSize = 40;
    const gridColor = isDark ? 'rgba(145,213,177,0.07)' : 'rgba(26,107,74,0.06)';
    container.style.backgroundImage =
      `linear-gradient(${gridColor} 1px, transparent 1px),
       linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`;
    container.style.backgroundSize = `${gridSize}px ${gridSize}px`;

    document.body.appendChild(container);

    for (const cd of cardsToExport) {
      const orig = canvas.querySelector(`.mb-card[data-card-id="${cd.cardId}"]`);
      if (!orig) continue;
      const clone = orig.cloneNode(true);
      clone.style.position = 'absolute';
      clone.style.left = `${cd.x - minX + PAD}px`;
      clone.style.top = `${cd.y - minY + PAD}px`;
      clone.style.transform = 'none';
      // Solid background fallback (backdrop-filter won't render in html2canvas)
      clone.style.backdropFilter = 'none';
      clone.style.webkitBackdropFilter = 'none';
      clone.style.background = isDark ? 'rgba(36,43,39,0.95)' : 'rgba(255,255,255,0.95)';
      // Remove interactive elements
      clone.querySelectorAll('.mb-card__delete, .mb-card__text-toggle, .mb-resize-handle').forEach(el => el.remove());
      clone.classList.remove('mb-card--selected', 'mb-card--dragging');
      container.appendChild(clone);
    }

    /* ── 3. html2canvas render ─────────────────────────────────────── */
    const scale = 2; // high-DPI
    const rendered = await window.html2canvas(container, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: isDark ? '#1a1f1c' : '#f3f6f4',
      width: bboxW,
      height: bboxH,
    });

    /* ── 4. Composite: corner branding ─────────────────────────────── */
    const final = document.createElement('canvas');
    final.width = rendered.width;
    final.height = rendered.height;
    const ctx = final.getContext('2d');
    ctx.drawImage(rendered, 0, 0);

    // Bottom-left corner branding: stacked-layers icon + text
    const fontSize = Math.max(36, Math.min(80, final.width * 0.045));
    const color = isDark ? '#91d5b1' : '#1a6b4a';
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = color;

    const s = fontSize * 0.04; // scale factor (24 SVG units → fontSize)
    const ix = 24;
    const iy = final.height - 10 - 12 * s - fontSize / 2;

    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, s * 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Top layer (filled diamond)
    ctx.beginPath();
    ctx.moveTo(ix + 12 * s, iy + 2 * s);
    ctx.lineTo(ix + 2 * s,  iy + 7 * s);
    ctx.lineTo(ix + 12 * s, iy + 12 * s);
    ctx.lineTo(ix + 22 * s, iy + 7 * s);
    ctx.closePath();
    ctx.stroke();

    // Middle layer
    ctx.beginPath();
    ctx.moveTo(ix + 2 * s,  iy + 12 * s);
    ctx.lineTo(ix + 12 * s, iy + 17 * s);
    ctx.lineTo(ix + 22 * s, iy + 12 * s);
    ctx.stroke();

    // Bottom layer
    ctx.beginPath();
    ctx.moveTo(ix + 2 * s,  iy + 17 * s);
    ctx.lineTo(ix + 12 * s, iy + 22 * s);
    ctx.lineTo(ix + 22 * s, iy + 17 * s);
    ctx.stroke();

    // Text beside icon
    const iconW = 22 * s;
    ctx.font = `800 ${fontSize}px -apple-system, "Segoe UI", sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('LumiNote', ix + iconW + 14, iy + 12 * s);

    /* ── 5. Download ───────────────────────────────────────────────── */
    final.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const suffix = state.selectedCardIds.size > 0 ? `_selected_${cardsToExport.length}` : '';
      a.download = `${state.activeSession.name || 'moodboard'}${suffix}_${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');

    /* ── 6. Cleanup ────────────────────────────────────────────────── */
    document.body.removeChild(container);

  } catch (e) {
    console.error('[moodboard] Export failed:', e);
    alert('Export failed: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = ''; }
  }
}
