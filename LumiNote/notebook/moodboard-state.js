/**
 * moodboard-state.js — Centralized moodboard state
 *
 * All shared mutable state lives here so that canvas, card, and export
 * modules can read/write a single source of truth without circular imports.
 *
 * Usage pattern:
 *   import { state } from './moodboard-state.js';
 *   state.zoom = 1.5;                   // write
 *   const z = state.zoom;               // read
 *   state.selectedCardIds.add('abc');    // mutate Set directly
 */

/* ─── DOM helper (shared across all modules) ─────────────────────── */

export const $ = (id) => document.getElementById(id);

/* ─── Core canvas / viewport state ───────────────────────────────── */

export const state = {
  /** @type {Array} All moodboard sessions from storage */
  sessions: [],

  /** @type {object|null} Currently loaded session (full object with .cards) */
  activeSession: null,

  /* ── Pan / Zoom ──────────────────────────────────────────────────── */
  panX: 0,
  panY: 0,
  zoom: 1,
  MIN_ZOOM: 0.15,
  MAX_ZOOM: 3,

  /* ── Panning interaction ─────────────────────────────────────────── */
  isPanning: false,
  panStartX: 0,
  panStartY: 0,
  panStartPanX: 0,
  panStartPanY: 0,

  /* ── Card dragging ───────────────────────────────────────────────── */
  draggingCard: null,
  dragStartX: 0,
  dragStartY: 0,
  dragCardStartX: 0,
  dragCardStartY: 0,

  /* ── Mouse position in canvas coords (for card placement) ────────── */
  mouseCanvasX: 0,
  mouseCanvasY: 0,

  /* ── Card selection (Alt+Click / Alt+Drag marquee) ───────────────── */
  /** @type {Set<string>} Card IDs currently selected */
  selectedCardIds: new Set(),
  isMarquee: false,
  marqueeStartX: 0,
  marqueeStartY: 0,
  /** @type {HTMLElement|null} Marquee rectangle overlay */
  marqueeEl: null,

  /* ── Undo ─────────────────────────────────────────────────────────── */
  /** @type {Array<Array>} Snapshot-based undo stack (card arrays) */
  undoStack: [],
  UNDO_LIMIT: 30,

  /* ── Save scheduling ─────────────────────────────────────────────── */
  saveTimer: null,
  /** Timestamp of our most recent save — used to ignore self-triggered storage events */
  _lastSaveTime: 0,
  /** @type {Function|null} chrome.storage.onChanged handler ref */
  _storageListener: null,

  /* ── Memory entries cache ─────────────────────────────────────────── */
  /** @type {Array} All memory entries (refreshed on session load) */
  allMemoryEntries: [],

};
