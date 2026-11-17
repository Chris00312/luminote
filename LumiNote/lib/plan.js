/**
 * plan.js — capability helpers (single tier).
 *
 * LumiNote has no paid plans anymore: every feature is available to every
 * user, with no quota and no gating. This module keeps the historical export
 * names so existing call sites continue to work, but there is only one tier.
 *
 * Limits that used to differ by plan (board count, entry count, AI calls/day,
 * export watermark) are all unlimited now. The only real limit left is what
 * the user's own AI provider enforces.
 */

/** Single capability set — unlimited everything. */
export const PLAN_CAPS = {
  free: {
    maxBoards:         Infinity,
    maxEntries:        Infinity,
    dailyAIBuiltin:    Infinity,
    canDeepExplain:    true,
    hasExportWatermark: false,
    canCollaborate:    true,
  },
};

/**
 * Always returns 'free' — there is only one tier. Kept as a promise-returning
 * function so existing `await getCurrentPlan()` call sites are unaffected.
 */
export function getCurrentPlan() {
  return Promise.resolve('free');
}

/** No paid tiers exist. */
export async function isPaidPlan() {
  return false;
}

/**
 * Look up a capability. Every capability is unrestricted, so numeric caps
 * return Infinity and booleans return true.
 */
export async function getCapability(cap) {
  const caps = PLAN_CAPS.free;
  return cap in caps ? caps[cap] : Infinity;
}
