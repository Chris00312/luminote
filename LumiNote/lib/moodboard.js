/**
 * LumiNote — Moodboard Sessions
 * Storage management for infinite canvas moodboard sessions.
 */

import { pushSession as syncPush, deleteCloudSession as syncDelete } from './cloud-sync.js';

const MB_STORAGE_KEY = 'luminote_moodboard_sessions';

/**
 * Get all moodboard sessions.
 * @returns {Promise<Array>}
 */
export async function getAllSessions() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [MB_STORAGE_KEY]: [] }, (result) => {
      resolve(result[MB_STORAGE_KEY]);
    });
  });
}

/**
 * Get a single session by id.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getSession(id) {
  const sessions = await getAllSessions();
  return sessions.find((s) => s.id === id) || null;
}

/**
 * Create a new session.
 * @param {Object} data - { name }
 * @returns {Promise<Object>} - The created session
 */
export async function createSession(data = {}) {
  const sessions = await getAllSessions();
  const session = {
    id: generateSessionId(),
    name: data.name || 'Untitled Board',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    viewport: { x: 0, y: 0, zoom: 1 },
    cards: [],
  };
  sessions.unshift(session);
  await setSessions(sessions);
  syncPush(session);
  return session;
}

/**
 * Update an existing session by id (partial patch).
 * @param {string} id
 * @param {Object} fields
 */
export async function updateSession(id, fields) {
  const sessions = await getAllSessions();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return;
  sessions[idx] = { ...sessions[idx], ...fields, updatedAt: Date.now() };
  await setSessions(sessions);
  syncPush(sessions[idx]);
}

/**
 * Delete a session by id.
 * @param {string} id
 */
export async function deleteSession(id) {
  const sessions = await getAllSessions();
  await setSessions(sessions.filter((s) => s.id !== id));
  syncDelete(id);
}

/**
 * Generate a unique card ID for use within a session.
 * @returns {string}
 */
export function generateCardId() {
  return `mbc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/* ─── Internal helpers ──────────────────────────────────────────── */

function setSessions(sessions) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [MB_STORAGE_KEY]: sessions }, resolve);
  });
}

function generateSessionId() {
  return `mb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
