/**
 * LumiRead — Learning Notebook
 * Local storage management for saved explanations.
 */

import { pushEntry as syncPush, pushRestoredEntry as syncRestore, deleteCloudEntry as syncDelete, getCurrentUser } from './cloud-sync.js';
import { getLocale } from './i18n.js';

const STORAGE_KEY = 'lumiread_notebook';
const TRASH_KEY   = 'lumiread_trash';
const TRASH_TTL_MS = 15 * 24 * 60 * 60 * 1000; // 15 days

/**
 * Save an entry to the notebook.
 * @param {Object} entry - { term, context, explanation, sourceUrl }
 * @returns {Promise<string>} - The new entry's id
 */
export async function saveEntry(entry) {
  const entries = await getAllEntries();
  const normalizedSourceUrl = normalizeSourceUrl(entry.sourceUrl || '');
  const newEntry = {
    id: generateId(),
    entryType: entry.entryType || 'text',
    term: entry.term || '',
    context: entry.context || '',
    note: entry.note || '',
    aiSummary: entry.aiSummary || entry.explanation || '',
    explanation: entry.aiSummary || entry.explanation || '',
    sourceUrl: entry.sourceUrl || '',
    sourceUrlNormalized: normalizedSourceUrl,
    sourceTitle: entry.sourceTitle || '',
    sourceKind: entry.sourceKind || 'web',
    sourcePage: Number.isFinite(entry.sourcePage) ? entry.sourcePage : null,
    sourceName: entry.sourceName || '',
    sourceAnchor: normalizeSourceAnchor(entry.sourceAnchor),
    sourceLocator: normalizeSourceLocator(entry.sourceLocator),
    imageUrl: entry.imageUrl || '',
    imageAlt: entry.imageAlt || '',
    timestamp: Date.now(),
    tags: entry.tags || [],
  };
  entries.unshift(newEntry);
  await setEntries(entries);
  syncPush(newEntry);  // fire-and-forget cloud sync
  return newEntry.id;
}

/**
 * Get all notebook entries, sorted by most recent.
 * @returns {Promise<Array>}
 */
export async function getAllEntries() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEY]: [] }, (result) => {
      resolve(result[STORAGE_KEY]);
    });
  });
}

/**
 * Update an existing entry by id (partial patch).
 * @param {string} id
 * @param {Object} fields - fields to overwrite
 */
export async function updateEntry(id, fields) {
  const entries = await getAllEntries();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return;
  entries[idx] = { ...entries[idx], ...fields };
  await setEntries(entries);
  syncPush(entries[idx]);  // fire-and-forget cloud sync
}

/**
 * Soft-delete an entry — moves it to the trash with a deletedAt timestamp.
 * Entries in trash are permanently removed after TRASH_TTL_MS (15 days).
 * @param {string} id
 */
export async function deleteEntry(id) {
  const entries = await getAllEntries();
  const entry = entries.find((e) => e.id === id);
  if (entry) {
    const trash = await getTrashRaw();
    trash.unshift({ ...entry, deletedAt: Date.now() });
    await setTrash(trash);
  }
  await setEntries(entries.filter((e) => e.id !== id));
  syncDelete(id);  // fire-and-forget cloud delete
}

/**
 * Get all trash entries, sorted by deletedAt desc.
 * Auto-purges entries older than TRASH_TTL_MS.
 * @returns {Promise<Array>}
 */
export async function getTrashEntries() {
  const trash = await getTrashRaw();
  const now = Date.now();
  const alive = trash.filter((e) => now - (e.deletedAt || 0) < TRASH_TTL_MS);
  if (alive.length !== trash.length) {
    await setTrash(alive);
  }
  return alive;
}

/**
 * Restore an entry from trash back to the main library.
 * @param {string} id
 */
export async function restoreEntry(id) {
  const trash = await getTrashRaw();
  const entry = trash.find((e) => e.id === id);
  if (!entry) return;
  const { deletedAt, ...clean } = entry;  // strip trash metadata
  const entries = await getAllEntries();
  entries.unshift(clean);
  await setEntries(entries);
  await setTrash(trash.filter((e) => e.id !== id));
  syncRestore(clean);  // fire-and-forget cloud re-sync (clears tombstone)
}

/**
 * Permanently delete a single entry from trash (no recovery).
 * @param {string} id
 */
export async function permanentDeleteEntry(id) {
  const trash = await getTrashRaw();
  await setTrash(trash.filter((e) => e.id !== id));
}

/**
 * Empty the entire trash immediately.
 */
export async function emptyTrash() {
  await setTrash([]);
}

/**
 * Search entries by term or explanation text.
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchEntries(query) {
  if (!query?.trim()) return getAllEntries();
  const entries = await getAllEntries();
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return entries;
  return entries.filter((e) => {
    const haystack = [
      e.term,
      e.note || '',
      e.aiSummary || e.explanation || '',
      e.imageAlt || '',
      e.sourceName || '',
      ...(e.tags || []),
    ].join(' ').toLowerCase();
    return tokens.every((t) => haystack.includes(t));
  });
}

/**
 * Get notebook entries for a specific source URL and type.
 * @param {Object} options
 * @param {string} options.sourceUrl
 * @param {'web'|'pdf'} [options.sourceKind]
 * @param {number} [options.limit]
 * @returns {Promise<Array>}
 */
export async function getEntriesForSource({ sourceUrl, sourceKind, limit = 20 }) {
  const entries = await getAllEntries();
  const normalizedTarget = normalizeSourceUrl(sourceUrl || '');
  if (!normalizedTarget) return [];

  return entries
    .filter((entry) => {
      if (sourceKind && entry.sourceKind !== sourceKind) return false;
      const normalizedEntryUrl = entry.sourceUrlNormalized || normalizeSourceUrl(entry.sourceUrl || '');
      return normalizedEntryUrl === normalizedTarget;
    })
    .slice(0, limit);
}

/**
 * Get total count of saved entries.
 * @returns {Promise<number>}
 */
export async function getCount() {
  const entries = await getAllEntries();
  return entries.length;
}

/**
 * Clear all notebook entries.
 */
export async function clearAll() {
  await setEntries([]);
}

/* ─── Internal helpers ──────────────────────────────────────────── */

export const TRASH_TTL_DAYS = 15;

function getTrashRaw() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [TRASH_KEY]: [] }, (r) => resolve(r[TRASH_KEY]));
  });
}

function setTrash(entries) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [TRASH_KEY]: entries }, resolve);
  });
}

function setEntries(entries) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: entries }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

function generateId() {
  return `lr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeSourceAnchor(anchor) {
  if (!anchor || typeof anchor !== 'object') return null;

  const normalized = {
    quote: String(anchor.quote || '').trim(),
    prefix: String(anchor.prefix || '').trim(),
    suffix: String(anchor.suffix || '').trim(),
    contextSnippet: String(anchor.contextSnippet || '').trim(),
  };

  if (!normalized.quote && !normalized.prefix && !normalized.suffix && !normalized.contextSnippet) {
    return null;
  }

  return normalized;
}

function normalizeSourceLocator(locator) {
  if (!locator || typeof locator !== 'object') return null;

  const normalized = {
    scope: String(locator.scope || '').trim(),
    blockPath: String(locator.blockPath || '').trim(),
    startOffsetInBlock: Number.isFinite(locator.startOffsetInBlock) ? locator.startOffsetInBlock : null,
    quoteLength: Number.isFinite(locator.quoteLength) ? locator.quoteLength : null,
    pageNumber: Number.isFinite(locator.pageNumber) ? locator.pageNumber : null,
  };

  const hasWebLocator = normalized.blockPath && normalized.startOffsetInBlock !== null;
  const hasPdfLocator = normalized.scope === 'pdf_page_text' && normalized.pageNumber !== null && normalized.startOffsetInBlock !== null;

  if (!hasWebLocator && !hasPdfLocator) {
    return null;
  }

  return normalized;
}

export function normalizeSourceUrl(url) {
  if (!url) return '';

  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return String(url).split('#')[0];
  }
}

/**
 * Format a timestamp to a readable date string.
 * @param {number} ts - Unix timestamp in ms
 * @returns {string}
 */
export function formatTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(getLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
