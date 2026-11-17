/**
 * sw-auth.js — Session helpers.
 *
 * LumiNote is BYOK-only and local-first: there is no account, no cloud
 * session and no AI quota. Everything the extension stores lives in
 * chrome.storage on this device.
 *
 * This module is kept as a thin shim so existing imports keep resolving.
 */

/* ─── Built-in AI quota constants (aligned with PLAN_CAPS) ────── */
export const BUILTIN_USAGE_KEY = 'luminote_builtin_usage';

export function _todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Read the legacy local usage counter.
 * Kept for storage compatibility with older installs; nothing enforces it.
 */
export function getBuiltinUsage() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [BUILTIN_USAGE_KEY]: null }, (result) => {
      const today = _todayStr();
      const usage = result[BUILTIN_USAGE_KEY];
      if (!usage || usage.date !== today) {
        resolve({ date: today, count: 0 });
      } else {
        resolve(usage);
      }
    });
  });
}

/** No-op kept for API compatibility — there is no quota to increment. */
export function incrementBuiltinUsage() {
  return Promise.resolve(0);
}
