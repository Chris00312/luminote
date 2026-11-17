/**
 * cloud-sync.js — local-only storage shim.
 *
 * LumiNote used to sync through a Cloudflare Worker (D1 + R2) with email or
 * Google accounts. The open-source build is fully local-first: there is no
 * account, no server and no network sync. Everything lives in chrome.storage
 * on this device.
 *
 * This module keeps the old export surface so callers (notebook.js,
 * moodboard.js, notebook page) need no changes. Every export is either a
 * no-op or a local-storage read.
 */

/* ─── Storage keys (unchanged, so upgrades keep existing data) ────── */

const ENTRIES_KEY = 'lumiread_notebook';
const MB_KEY      = 'luminote_moodboard_sessions';

/* ─── chrome.storage helpers ─────────────────────────────────────── */

function csGet(key, fallback = null) {
  return new Promise(r => chrome.storage.local.get({ [key]: fallback }, d => r(d[key])));
}

/* ─── State ──────────────────────────────────────────────────────── */

/**
 * There is no signed-in user anymore. Kept as a function so callers that
 * branch on "am I synced?" simply take the local path.
 */
export function getCurrentUser() {
  return null;
}

export async function initSync() {
  // Nothing to restore — local storage is already the source of truth.
}

export function startAutoSync() {
  // No remote to sync with.
}

export function stopAutoSync() {
  // No-op.
}

/* ─── Write hooks (previously network pushes) ────────────────────── */

export function pushEntry(/* entry */) {}
export function pushSession(/* session */) {}
export function pushRestoredEntry(/* entry */) {}
export function deleteCloudEntry(/* id */) {}
export function deleteCloudSession(/* id */) {}
export function markDirty() {}

/* ─── Sync entry points ──────────────────────────────────────────── */

export async function pullOnly() {
  return { downloaded: 0 };
}

export async function fullSync() {
  return { uploaded: 0, downloaded: 0, errors: [] };
}

export async function flushPending() {}

/* ─── Local helpers still used by the UI ─────────────────────────── */

/** Count of locally stored memories — used by settings/status displays. */
export async function getLocalCounts() {
  const [entries, sessions] = await Promise.all([
    csGet(ENTRIES_KEY, []),
    csGet(MB_KEY, []),
  ]);
  return { entries: entries?.length || 0, sessions: sessions?.length || 0 };
}
