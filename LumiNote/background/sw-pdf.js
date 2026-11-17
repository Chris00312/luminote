/**
 * sw-pdf.js — PDF context tracking and URL helpers.
 */

import { getEntriesForSource } from '../lib/notebook.js';

export const PDF_CONTEXTS_KEY = 'lumiread_pdf_contexts';
export const PDF_VIEWER_PATH = 'pdf-viewer/pdf-viewer.html';

/* ─── Session helpers ───────────────────────────────────────────── */

export function loadPdfContexts() {
  return new Promise((resolve) => {
    chrome.storage.session.get({ [PDF_CONTEXTS_KEY]: {} }, (result) => {
      resolve(result[PDF_CONTEXTS_KEY]);
    });
  });
}

export async function getPdfContext(tabId) {
  const contexts = await loadPdfContexts();
  return contexts[String(tabId)] || null;
}

export async function upsertPdfContext(tabId, next) {
  const contexts = await loadPdfContexts();
  contexts[String(tabId)] = {
    ...(contexts[String(tabId)] || {}),
    ...next,
  };

  await new Promise((resolve) => {
    chrome.storage.session.set({ [PDF_CONTEXTS_KEY]: contexts }, resolve);
  });
}

export async function removePdfContext(tabId) {
  const contexts = await loadPdfContexts();
  if (!(String(tabId) in contexts)) return;

  delete contexts[String(tabId)];
  await new Promise((resolve) => {
    chrome.storage.session.set({ [PDF_CONTEXTS_KEY]: contexts }, resolve);
  });
}

export function isAllowedFileSchemeAccess() {
  return new Promise((resolve) => {
    chrome.extension.isAllowedFileSchemeAccess(resolve);
  });
}

/* ─── URL helpers ───────────────────────────────────────────────── */

export function isDirectPdfUrl(url) {
  return /^https?:\/\/.+\.pdf(?:[?#].*)?$/i.test(url) || /^file:\/\/.+\.pdf(?:[?#].*)?$/i.test(url);
}

export function looksLikePdfUrl(url) {
  if (isDirectPdfUrl(url)) return true;

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'file:') {
      return /\.pdf(?:[?#].*)?$/i.test(parsed.pathname);
    }

    if (!/^https?:$/i.test(parsed.protocol)) return false;
    return /\/pdf\/|\/pdf$|[?&](pdf|format)=/i.test(`${parsed.pathname}${parsed.search}`);
  } catch {
    return false;
  }
}

export async function detectPdfUrl(url) {
  if (looksLikePdfUrl(url)) return url;

  try {
    const parsed = new URL(url);
    if (!/^https?:$/i.test(parsed.protocol)) {
      return '';
    }
  } catch {
    return '';
  }

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.toLowerCase().includes('application/pdf')) {
      return response.url || url;
    }
  } catch {
    // Ignore probe failures and fall back to non-PDF.
  }

  return '';
}

export function isChromeExtensionUrl(url) {
  return url.startsWith('chrome-extension://');
}

export function getPdfNameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split('/').filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : 'document.pdf';
  } catch {
    return 'document.pdf';
  }
}

/* ─── Tab-level PDF context resolution ─────────────────────────── */

export async function getPdfContextForTab(tab) {
  if (!tab?.id) {
    return {
      isPdf: false,
      canOpen: false,
      reason: 'No active tab found.',
    };
  }

  const currentUrl = tab.pendingUrl || tab.url || '';
  if (!currentUrl) {
    return {
      isPdf: false,
      canOpen: false,
      reason: 'Current tab URL is unavailable.',
    };
  }

  if (currentUrl.startsWith(chrome.runtime.getURL(PDF_VIEWER_PATH))) {
    return {
      isPdf: false,
      canOpen: false,
      reason: 'Already in LumiNote PDF mode.',
    };
  }

  const stored = await getPdfContext(tab.id);
  let sourceUrl = '';
  let sourceName = '';

  if (looksLikePdfUrl(currentUrl)) {
    sourceUrl = currentUrl;
    sourceName = getPdfNameFromUrl(currentUrl);
  } else if (stored?.sourceUrl && isChromeExtensionUrl(currentUrl)) {
    sourceUrl = stored.sourceUrl;
    sourceName = stored.sourceName || getPdfNameFromUrl(stored.sourceUrl);
  } else {
    const detectedUrl = await detectPdfUrl(currentUrl);
    if (detectedUrl) {
      sourceUrl = detectedUrl;
      sourceName = getPdfNameFromUrl(detectedUrl);
      await upsertPdfContext(tab.id, {
        sourceUrl,
        sourceName,
        detectedVia: 'probe',
        updatedAt: Date.now(),
      });
    }
  }

  if (!sourceUrl) {
    return {
      isPdf: false,
      canOpen: false,
      reason: 'Open a PDF tab first.',
    };
  }

  const isLocalFile = sourceUrl.startsWith('file:');
  const fileAccessAllowed = isLocalFile ? await isAllowedFileSchemeAccess() : true;

  if (isLocalFile && !fileAccessAllowed) {
    return {
      isPdf: true,
      canOpen: false,
      isLocalFile: true,
      fileAccessAllowed: false,
      sourceUrl,
      sourceName,
      reason: 'Enable "Allow access to file URLs" for LumiNote first.',
    };
  }

  return {
    isPdf: true,
    canOpen: true,
    sourceUrl,
    sourceName,
    isLocalFile,
    fileAccessAllowed,
    viewerUrl: chrome.runtime.getURL(`${PDF_VIEWER_PATH}?src=${encodeURIComponent(sourceUrl)}`),
  };
}

/* ─── Message handlers ─────────────────────────────────────────── */

export async function handleGetPdfContext(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const context = await getPdfContextForTab(tab);
    sendResponse(context);
  } catch (error) {
    sendResponse({
      isPdf: false,
      canOpen: false,
      reason: error.message || String(error),
    });
  }
}

export async function handleGetRevisitEntries(message, sendResponse) {
  try {
    const entries = await getEntriesForSource({
      sourceUrl: message.sourceUrl || '',
      sourceKind: message.sourceKind || 'web',
      limit: Number.isFinite(message.limit) ? message.limit : 20,
    });
    sendResponse({ ok: true, entries });
  } catch (error) {
    sendResponse({ ok: false, error: error.message || String(error), entries: [] });
  }
}

/* ─── Listener init (called from service-worker.js) ────────────── */

export function initPdfListeners() {
  chrome.webRequest.onHeadersReceived.addListener(
    async (details) => {
      if (details.tabId < 0 || details.type !== 'main_frame') return;

      const contentType = details.responseHeaders?.find((header) => header.name.toLowerCase() === 'content-type')?.value || '';
      if (!contentType.toLowerCase().includes('application/pdf')) return;

      await upsertPdfContext(details.tabId, {
        sourceUrl: details.url,
        sourceName: getPdfNameFromUrl(details.url),
        detectedVia: 'headers',
        updatedAt: Date.now(),
      });
    },
    { urls: ['<all_urls>'], types: ['main_frame'] },
    ['responseHeaders']
  );

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    const url = changeInfo.url || tab.url || '';
    if (!url) return;

    if (looksLikePdfUrl(url)) {
      await upsertPdfContext(tabId, {
        sourceUrl: url,
        sourceName: getPdfNameFromUrl(url),
        detectedVia: 'url',
        updatedAt: Date.now(),
      });
      return;
    }

    if (url.startsWith(chrome.runtime.getURL(PDF_VIEWER_PATH))) {
      return;
    }

    if (!isChromeExtensionUrl(url)) {
      await removePdfContext(tabId);
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    removePdfContext(tabId);
  });
}
