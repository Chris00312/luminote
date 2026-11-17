/**
 * sw-context-menu.js — Context menu and image mark card handling.
 */

export const MARK_IMAGE_MENU_ID = 'lumiread-mark-image';
let contextMenusReady = false;

/* ─── Install / update handler ──────────────────────────────────── */

export function ensureContextMenus(force = false) {
  if (contextMenusReady && !force) return;

  chrome.contextMenus.removeAll(() => {
    void chrome.runtime.lastError;
    chrome.contextMenus.create(
      {
        id: MARK_IMAGE_MENU_ID,
        title: 'Mark the image',
        contexts: ['image'],
      },
      () => {
        if (chrome.runtime.lastError) {
          contextMenusReady = false;
          return;
        }

        contextMenusReady = true;
      }
    );
  });
}

export async function openImageMarkCard(tabId, payload) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, payload);
    if (response?.ok) return;
  } catch {
    // Fall through and try a one-off injection for already-open tabs after extension reloads.
  }

  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content/content.css'],
    });
  } catch {
    // Ignore CSS injection failures and still try JS.
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/content.js'],
  });

  await chrome.tabs.sendMessage(tabId, payload);
}

/* ─── Listener init (called from service-worker.js) ────────────── */

export function initContextMenuListeners() {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== MARK_IMAGE_MENU_ID || !tab?.id || !info.srcUrl) return;

    openImageMarkCard(tab.id, {
      type: 'OPEN_IMAGE_MARK_CARD',
      imageUrl: info.srcUrl,
      pageUrl: info.pageUrl || tab.url || '',
      pageTitle: tab.title || '',
    }).catch(() => {});
  });
}
