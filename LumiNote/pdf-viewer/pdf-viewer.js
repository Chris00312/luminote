import * as pdfjsLib from '../vendor/pdfjs/legacy/build/pdf.mjs';
import { initLocale, applyI18n, t } from '../lib/i18n.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('vendor/pdfjs/legacy/build/pdf.worker.mjs');
globalThis.pdfjsLib = pdfjsLib;

const { EventBus, PDFLinkService, PDFViewer } = await import('../vendor/pdfjs/legacy/web/pdf_viewer.mjs');

const $ = (id) => document.getElementById(id);

let pdfDocument = null;
let pdfViewer = null;
let currentScale = 1;
let currentPageNumber = 1;
let sourceUrl = '';
let sourceName = 'document.pdf';
let requestedPageNumber = 1;
let requestedEntryId = '';

let bubble = null;
let card = null;
let currentSelection = null;
let currentContext = null;
let currentSelectionLocator = null;
let currentDepth = 'brief';
let currentSelectionPage = 1;
let currentMode = 'note';
let aiConfigured = false;
const loadingDepths = new Set();
let revisitEntries = [];
let focusedRevisitEntryId = '';
const highlightedRevisitEntries = new Set();

init().catch((error) => {
  showError(error.message || String(error));
});

async function init() {
  await initLocale();
  applyI18n();

  const params = new URLSearchParams(location.search);
  sourceUrl = params.get('src') || '';
  requestedPageNumber = Number(params.get('page')) || 1;
  requestedEntryId = params.get('entryId') || '';

  // No PDF source — show upload prompt
  if (!sourceUrl) {
    $('loading-state').classList.add('pdf-state--hidden');
    $('upload-state').classList.remove('pdf-state--hidden');
    $('doc-title').textContent = '';
    bindUpload();
    return;
  }

  if (sourceUrl.startsWith('file:') && !(await isAllowedFileSchemeAccess())) {
    throw new Error('Enable "Allow access to file URLs" for LumiNote, then reopen this PDF.');
  }

  revisitEntries = await loadRevisitEntries();
  focusedRevisitEntryId = requestedEntryId || revisitEntries[0]?.id || '';

  bindToolbar();
  bindSelection();
  bindRuntimeMessages();

  // Re-apply i18n when display language changes
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'sync' && changes['displayLanguage']) {
      await initLocale();
      applyI18n();
    }
  });

  await loadPdf(sourceUrl);
}

function bindUpload() {
  const uploadBtn = $('upload-btn');
  const fileInput = $('pdf-file-input');
  if (!uploadBtn || !fileInput) return;

  uploadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    // Switch to loading state
    $('upload-state').classList.add('pdf-state--hidden');
    $('loading-state').classList.remove('pdf-state--hidden');

    try {
      const buffer = await file.arrayBuffer();
      sourceName = file.name;

      // Now bind the rest of the viewer UI
      bindToolbar();
      bindSelection();
      bindRuntimeMessages();

      await loadPdf(null, buffer);
    } catch (e) {
      showError(e.message || String(e));
    }
  });
}

async function loadPdf(url, data) {
  const eventBus = new EventBus();
  const linkService = new PDFLinkService({ eventBus });

  pdfViewer = new PDFViewer({
    container: $('viewerContainer'),
    viewer: $('viewer'),
    eventBus,
    linkService,
    textLayerMode: 1,
    annotationMode: pdfjsLib.AnnotationMode.DISABLE,
    defaultZoomValue: '1',   // render at 100% from the start — avoids post-init re-render
  });

  linkService.setViewer(pdfViewer);

  eventBus.on('pagesinit', () => {
    showViewer();
    currentScale = 1;
    updateZoomLabel();

    // Navigate to the target page (no scale change needed — defaultZoomValue handles it)
    const primaryEntry = getPrimaryRevisitEntry();
    if (primaryEntry?.sourcePage) {
      pdfViewer.currentPageNumber = primaryEntry.sourcePage;
    } else if (requestedPageNumber > 0) {
      pdfViewer.currentPageNumber = requestedPageNumber;
    }
  });

  eventBus.on('pagechanging', ({ pageNumber }) => {
    currentPageNumber = pageNumber;
    updatePageIndicators();
  });

  eventBus.on('textlayerrendered', ({ pageNumber }) => {
    highlightRevisitEntriesForPage(pageNumber);
  });

  eventBus.on('scalechanging', ({ scale, presetValue }) => {
    // Clear highlighted set so re-rendered text layers get highlights re-applied
    highlightedRevisitEntries.clear();
    currentScale = presetValue || scale;
    updateZoomLabel(scale);
  });

  // Build PDF.js document source — either ArrayBuffer (local upload) or URL
  const docSource = data
    ? { data, cMapUrl: chrome.runtime.getURL('vendor/pdfjs/cmaps/'), cMapPacked: true, standardFontDataUrl: chrome.runtime.getURL('vendor/pdfjs/standard_fonts/') }
    : { url, cMapUrl: chrome.runtime.getURL('vendor/pdfjs/cmaps/'), cMapPacked: true, standardFontDataUrl: chrome.runtime.getURL('vendor/pdfjs/standard_fonts/') };

  const loadingTask = pdfjsLib.getDocument(docSource);

  pdfDocument = await loadingTask.promise;
  pdfViewer.setDocument(pdfDocument);
  linkService.setDocument(pdfDocument, null);

  // For local uploads keep the file name from query params; otherwise resolve from PDF metadata / URL
  const paramName = new URLSearchParams(location.search).get('name');
  sourceName = paramName || await resolveDocumentName(url);
  document.title = `${sourceName} — LumiNote PDF Mode`;
  $('doc-title').textContent = sourceName;

  // Hide "Open original" for local uploads (no useful URL to open)
  if (!url) {
    $('open-source-btn').style.display = 'none';
  } else {
    $('open-source-btn').title = sourceUrl;
  }

  updatePageIndicators();
}

function bindToolbar() {
  $('prev-page-btn').addEventListener('click', () => {
    if (!pdfViewer) return;
    pdfViewer.currentPageNumber = Math.max(1, pdfViewer.currentPageNumber - 1);
  });

  $('next-page-btn').addEventListener('click', () => {
    if (!pdfViewer || !pdfDocument) return;
    pdfViewer.currentPageNumber = Math.min(pdfDocument.numPages, pdfViewer.currentPageNumber + 1);
  });

  $('zoom-in-btn').addEventListener('click', () => {
    if (!pdfViewer) return;
    const nextScale = Math.min(3, (typeof pdfViewer.currentScale === 'number' ? pdfViewer.currentScale : 1) * 1.15);
    pdfViewer.currentScale = nextScale;
  });

  $('zoom-out-btn').addEventListener('click', () => {
    if (!pdfViewer) return;
    const nextScale = Math.max(0.5, (typeof pdfViewer.currentScale === 'number' ? pdfViewer.currentScale : 1) / 1.15);
    pdfViewer.currentScale = nextScale;
  });

  $('open-source-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: sourceUrl });
  });

  $('viewerContainer').addEventListener('scroll', () => {
    hideBubble();
    hideCard();
  }, { passive: true });
}

function bindSelection() {
  document.addEventListener('mouseup', (event) => {
    if (isLumiReadElement(event.target)) return;

    if (!event.target.closest('#viewerContainer')) {
      hideBubble();
      return;
    }

    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (text && text.length > 1 && text.length < 5000) {
        currentSelection = text;
        currentContext = extractContext(selection);
        currentSelectionPage = getSelectionPageNumber(selection);
        currentSelectionLocator = buildPdfSourceLocator(selection, currentSelectionPage, text);
        showBubble(selection);
      } else {
        hideBubble();
      }
    }, 10);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideBubble();
      hideCard();
    }
  });
}

function bindRuntimeMessages() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PDF_EXPLAIN_CHUNK') {
      handleChunk(message.chunk, message.depth);
    }

    if (message.type === 'PDF_EXPLAIN_DONE') {
      handleDone(message.fullText, message.depth, message.related, message.tags);
    }

    if (message.type === 'PDF_EXPLAIN_ERROR') {
      handleError(message.error, message.depth);
    }
  });
}

function extractContext(selection) {
  try {
    const range = selection.getRangeAt(0);
    const anchor = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentElement
      : range.commonAncestorContainer;
    const page = anchor?.closest('.page');
    const text = page?.querySelector('.textLayer')?.innerText || page?.innerText || '';
    return text.trim().slice(0, 1000);
  } catch {
    return '';
  }
}

function getSelectionPageNumber(selection) {
  try {
    const range = selection.getRangeAt(0);
    const anchor = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentElement
      : range.commonAncestorContainer;
    const page = anchor?.closest('.page');
    return Number(page?.dataset.pageNumber) || currentPageNumber || 1;
  } catch {
    return currentPageNumber || 1;
  }
}

function showBubble(selection) {
  hideBubble();

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  bubble = document.createElement('div');
  bubble.className = 'lumiread-bubble';
  bubble.setAttribute('data-lumiread', 'true');
  bubble.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <span>Mark</span>
  `;

  bubble.style.left = `${rect.right + window.scrollX}px`;
  bubble.style.top = `${rect.top + window.scrollY - 36}px`;

  bubble.addEventListener('mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideBubble();
    openCard(rect);
  });

  document.body.appendChild(bubble);

  requestAnimationFrame(() => {
    const bubbleRect = bubble.getBoundingClientRect();
    if (bubbleRect.right > window.innerWidth - 10) {
      bubble.style.left = `${rect.left + window.scrollX}px`;
      bubble.style.transform = 'translateX(-100%)';
    }
  });
}

function hideBubble() {
  if (!bubble) return;
  bubble.remove();
  bubble = null;
}

function openCard(selectionRect) {
  hideCard();
  if (!currentSelection) return;

  currentDepth = 'brief';
  currentMode = 'note';
  loadingDepths.clear();
  aiConfigured = false;

  card = document.createElement('div');
  card.className = 'lumiread-card';
  card.setAttribute('data-lumiread', 'true');
  card.innerHTML = buildCardHTML(currentSelection);

  positionCard(selectionRect);
  document.body.appendChild(card);

  bindCardEvents();
  hydrateAiAvailability();
  card.querySelector('.lr-note-input')?.focus();

  setTimeout(() => {
    document.addEventListener('mousedown', onOutsideClick);
  }, 100);
}

function buildCardHTML(term) {
  return `
    <div class="lr-card-header">
      <div class="lr-logo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M2 17l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        </svg>
        <span>LumiNote</span>
      </div>
      <button class="lr-close-btn" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <div class="lr-term">${escapeHtml(term)}</div>

    <div class="lr-mode-row">
      <div class="lr-mode-group">
        <button class="lr-mode-btn lr-mode-btn--active" data-mode="note">Note</button>
        <button class="lr-mode-ai-btn" data-mode="ai" title="Generate AI summary" aria-label="Generate AI summary" disabled>
          <span>AI</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z"/>
            <path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9L18 15z"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="lr-content-area">
      <div class="lr-note-section" data-panel="note">
        <label class="lr-note-label" for="lr-note-input">Note</label>
        <textarea id="lr-note-input" class="lr-note-input" placeholder="Write why this matters, what to revisit, or leave a quick snapshot note..."></textarea>
      </div>
      <div class="lr-ai-panel lr-ai-panel--hidden" data-panel="ai">
        <div class="lr-ai-caption">AI summary is optional. Use the AI button only when you want an automatic explanation.</div>
        <div class="lr-ai-empty">No AI summary yet.</div>
        <div class="lr-streaming-text"></div>
        <div class="lr-cursor"></div>
        <div class="lr-related-section lr-hidden"></div>
      </div>
    </div>

    <div class="lr-card-footer">
      <button class="lr-save-btn" title="Save to notebook">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        Save
      </button>
      <span class="lr-source-label" title="${escapeHtml(sourceName)}">
        ${escapeHtml(truncate(sourceName, 30))} · p.${currentSelectionPage}
      </span>
    </div>
  `;
}

function bindCardEvents() {
  card.querySelector('.lr-close-btn').addEventListener('click', () => hideCard());

  card.querySelector('.lr-mode-btn[data-mode="note"]').addEventListener('click', () => {
    switchMode('note');
  });

  card.querySelector('.lr-mode-ai-btn').addEventListener('click', () => {
    if (!aiConfigured) return;
    switchMode('ai');
    if (!loadingDepths.has(currentDepth) && !getAiTextEl()?.dataset.loaded) {
      requestExplanation(currentDepth);
    }
  });

  card.querySelector('.lr-save-btn').addEventListener('click', () => saveToNotebook());
}

function switchMode(mode) {
  if (!card) return;
  currentMode = mode;
  card.querySelector('.lr-mode-btn[data-mode="note"]').classList.toggle('lr-mode-btn--active', mode === 'note');
  card.querySelector('.lr-mode-ai-btn').classList.toggle('lr-mode-ai-btn--active', mode === 'ai');
  card.querySelector('[data-panel="note"]').classList.toggle('lr-panel--hidden', mode !== 'note');
  card.querySelector('[data-panel="ai"]').classList.toggle('lr-ai-panel--hidden', mode !== 'ai');
}

function requestExplanation(depth) {
  loadingDepths.add(depth);
  const panelEl = getAiPanel();
  if (!panelEl) return;

  const textEl = panelEl.querySelector('.lr-streaming-text');
  const cursor = panelEl.querySelector('.lr-cursor');
  const emptyState = panelEl.querySelector('.lr-ai-empty');
  textEl.textContent = '';
  textEl.dataset.raw = '';
  delete textEl.dataset.loaded;
  cursor.classList.add('lr-cursor--active');
  emptyState.style.display = 'none';

  chrome.runtime.sendMessage({
    type: 'PDF_EXPLAIN_REQUEST',
    selectedText: currentSelection,
    context: currentContext,
    depth,
  });
}

function handleChunk(chunk, depth) {
  if (!card) return;
  if (depth !== currentDepth) return;
  const panelEl = getAiPanel();
  if (!panelEl) return;
  const textEl = panelEl.querySelector('.lr-streaming-text');
  panelEl.querySelector('.lr-ai-empty').style.display = 'none';

  textEl.innerHTML = renderMarkdownLite((textEl.dataset.raw || '') + chunk);
  textEl.dataset.raw = (textEl.dataset.raw || '') + chunk;
}

let _pdfPendingTags = [];

function handleDone(fullText, depth, related, tags) {
  _pdfPendingTags = tags || [];
  loadingDepths.delete(depth);
  if (!card) return;
  if (depth !== currentDepth) return;

  const panelEl = getAiPanel();
  if (!panelEl) return;

  const textEl = panelEl.querySelector('.lr-streaming-text');
  const cursor = panelEl.querySelector('.lr-cursor');

  textEl.dataset.raw = fullText;
  textEl.innerHTML = renderMarkdownLite(fullText);
  textEl.dataset.loaded = '1';
  cursor.classList.remove('lr-cursor--active');

  if (depth === 'deep' && related?.length > 0) {
    const relatedEl = panelEl.querySelector('.lr-related-section');
    relatedEl.classList.remove('lr-hidden');
    relatedEl.innerHTML = `
      <div class="lr-related-title">Related concepts</div>
      <div class="lr-related-tags">
        ${related.map((term) => `<button class="lr-related-tag">${escapeHtml(term)}</button>`).join('')}
      </div>
    `;

    relatedEl.querySelectorAll('.lr-related-tag').forEach((button) => {
      button.addEventListener('click', () => {
        currentSelection = button.textContent;
        currentContext = '';
        currentSelectionLocator = null;
        currentMode = 'ai';
        card.querySelector('.lr-term').textContent = button.textContent;
        const aiPanel = getAiPanel();
        const textNode = aiPanel.querySelector('.lr-streaming-text');
        textNode.textContent = '';
        textNode.dataset.raw = '';
        delete textNode.dataset.loaded;
        const relatedSection = aiPanel.querySelector('.lr-related-section');
        relatedSection.classList.add('lr-hidden');
        relatedSection.innerHTML = '';
        switchMode('ai');
        requestExplanation(currentDepth);
      });
    });
  }
}

function handleError(error, depth) {
  loadingDepths.delete(depth);
  if (!card) return;
  if (depth !== currentDepth) return;

  const panelEl = getAiPanel();
  if (!panelEl) return;

  const textEl = panelEl.querySelector('.lr-streaming-text');
  const cursor = panelEl.querySelector('.lr-cursor');
  const emptyState = panelEl.querySelector('.lr-ai-empty');
  cursor.classList.remove('lr-cursor--active');
  if (error === 'NO_API_KEY') {
    textEl.innerHTML = `<span class="lr-error">${t('no_api_key')}<a href="#" class="lr-error-link">${t('no_api_key_link')}</a></span>`;
    textEl.querySelector('.lr-error-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  } else {
    textEl.innerHTML = `<span class="lr-error">${escapeHtml(error)}</span>`;
  }
  emptyState.style.display = 'none';
}

function saveToNotebook() {
  const aiSummary = getAiTextEl()?.dataset.raw || '';
  const note = card?.querySelector('.lr-note-input')?.value.trim() || '';

  chrome.runtime.sendMessage({
    type: 'SAVE_ENTRY',
    entry: {
      term: currentSelection,
      context: currentContext,
      note,
      aiSummary,
      sourceUrl,
      sourceTitle: sourceName,
      sourceKind: 'pdf',
      sourcePage: currentSelectionPage,
      sourceName,
      sourceAnchor: buildSourceAnchor(currentSelection, currentContext),
      sourceLocator: currentSelectionLocator,
      tags: _pdfPendingTags.length ? _pdfPendingTags : [],
    },
  }, () => {
    void chrome.runtime.lastError;
  });

  const button = card?.querySelector('.lr-save-btn');
  if (!button) return;

  button.classList.add('lr-save-btn--saved');
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
    Saved!
  `;

  setTimeout(() => {
    button.classList.remove('lr-save-btn--saved');
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
      Save
    `;
  }, 2000);
}

function positionCard(selectionRect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left;
  let top;

  if (selectionRect) {
    left = selectionRect.left + window.scrollX;
    top = selectionRect.bottom + window.scrollY + 8;

    if (left + 420 > vw + window.scrollX) {
      left = Math.max(window.scrollX + 8, selectionRect.right + window.scrollX - 420);
    }
    if (top - window.scrollY + 300 > vh) {
      top = selectionRect.top + window.scrollY - 8;
      card.style.transform = 'translateY(-100%)';
    }
  } else {
    left = window.scrollX + (vw - 420) / 2;
    top = window.scrollY + vh * 0.25;
  }

  card.style.left = `${Math.max(window.scrollX + 8, left)}px`;
  card.style.top = `${top}px`;
}

function hideCard() {
  if (card) {
    card.classList.add('lumiread-card--exit');
    setTimeout(() => {
      card?.remove();
      card = null;
    }, 200);
  }
  document.removeEventListener('mousedown', onOutsideClick);
}

function onOutsideClick(event) {
  if (!isLumiReadElement(event.target)) {
    hideCard();
  }
}

function updatePageIndicators() {
  const totalPages = pdfDocument?.numPages || 1;
  $('page-label').textContent = `${currentPageNumber} / ${totalPages}`;
  $('page-chip').textContent = `p.${currentPageNumber}`;
}

function updateZoomLabel(scaleValue = pdfViewer?.currentScale) {
  if (currentScale === 'page-width') {
    $('zoom-label').textContent = 'Fit width';
    return;
  }

  if (typeof scaleValue === 'number') {
    $('zoom-label').textContent = `${Math.round(scaleValue * 100)}%`;
  }
}

function showViewer() {
  $('loading-state').classList.add('pdf-state--hidden');
  $('error-state').classList.add('pdf-state--hidden');
  $('viewer-shell').classList.remove('pdf-state--hidden');
  createPdfFab();
}

async function hydrateAiAvailability() {
  const config = await loadUiConfig();
  aiConfigured = config.aiConfigured;
  currentDepth = config.aiSummaryDepth;
  if (!card) return;

  const button = card.querySelector('.lr-mode-ai-btn');
  if (!button) return;

  button.disabled = !aiConfigured;
  button.title = aiConfigured
    ? `Generate AI summary (${currentDepth})`
    : 'Configure an AI API key in settings to use AI summaries';
  button.setAttribute('aria-label', button.title);
}

async function loadRevisitEntries() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: 'GET_REVISIT_ENTRIES',
      sourceUrl,
      sourceKind: 'pdf',
      limit: 20,
    }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        resolve([]);
        return;
      }

      resolve(dedupeEntries(response.entries || []));
    });
  });
}

function getPrimaryRevisitEntry() {
  if (requestedEntryId) {
    const targetedEntry = revisitEntries.find((entry) => entry.id === requestedEntryId);
    if (targetedEntry) return targetedEntry;
  }

  if (requestedPageNumber > 0) {
    const pageEntry = revisitEntries.find((entry) => entry.sourcePage === requestedPageNumber);
    if (pageEntry) return pageEntry;
  }

  return revisitEntries[0] || null;
}

function highlightRevisitEntriesForPage(pageNumber) {
  const page = document.querySelector(`.page[data-page-number="${pageNumber}"]`);
  const textLayer = page?.querySelector('.textLayer');
  if (!textLayer) return;

  const entriesForPage = revisitEntries.filter((entry) => {
    if (highlightedRevisitEntries.has(entry.id)) return false;
    if (Number.isFinite(entry.sourcePage)) {
      return entry.sourcePage === pageNumber;
    }
    return pageNumber === currentPageNumber;
  });

  for (const entry of entriesForPage) {
    const highlight = highlightSavedEntry(textLayer, entry);
    if (!highlight) continue;

    highlightedRevisitEntries.add(entry.id);

    if (entry.id === focusedRevisitEntryId) {
      focusRevisitHighlight(highlight);
    }
  }
}

function highlightSavedEntry(root, entry) {
  const term = String(entry.term || '').trim();
  if (!term) return null;

  const preciseCandidate = findPrecisePdfCandidate(root, entry, term);
  if (preciseCandidate) {
    return wrapTextMatch(preciseCandidate.node, preciseCandidate.index, term.length, entry, 'pdf');
  }

  const candidate = findBestTextCandidate(root, term, entry);
  if (!candidate) return null;

  return wrapTextMatch(candidate.node, candidate.index, term.length, entry, 'pdf');
}

function findPrecisePdfCandidate(root, entry, term) {
  const locator = entry.sourceLocator || null;
  if (!locator || locator.scope !== 'pdf_page_text') return null;
  if (Number.isFinite(locator.pageNumber) && locator.pageNumber !== entry.sourcePage) return null;
  if (!Number.isFinite(locator.startOffsetInBlock)) return null;

  const targetOffset = locator.startOffsetInBlock;
  const termLower = term.toLowerCase();
  let absoluteOffset = 0;
  let best = null;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return isSearchableTextNode(node)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.textContent || '';
    const lower = text.toLowerCase();
    let index = lower.indexOf(termLower);

    while (index !== -1) {
      const matchOffset = absoluteOffset + index;
      if (matchOffset === targetOffset) {
        return { node, index };
      }

      const distance = Math.abs(matchOffset - targetOffset);
      if (!best || distance < best.distance) {
        best = { node, index, distance };
      }

      index = lower.indexOf(termLower, index + term.length);
    }

    absoluteOffset += text.length;
  }

  return best;
}

function findBestTextCandidate(root, term, entry) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return isSearchableTextNode(node)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const termLower = term.toLowerCase();
  let best = null;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const haystack = node.textContent || '';
    const lower = haystack.toLowerCase();
    let index = lower.indexOf(termLower);

    while (index !== -1) {
      const score = scoreCandidate(root, entry);
      if (!best || score > best.score) {
        best = { node, index, score };
      }

      index = lower.indexOf(termLower, index + term.length);
    }
  }

  return best;
}

function scoreCandidate(root, entry) {
  const rootText = normalizeText(root?.innerText || root?.textContent || '');
  const anchor = entry.sourceAnchor || {};
  let score = 1;

  const contextSnippet = normalizeText(anchor.contextSnippet || entry.context || '');
  const prefix = normalizeText(anchor.prefix || '');
  const suffix = normalizeText(anchor.suffix || '');

  if (contextSnippet && rootText.includes(contextSnippet)) score += 8;
  if (prefix && rootText.includes(prefix)) score += 3;
  if (suffix && rootText.includes(suffix)) score += 3;

  return score;
}

function wrapTextMatch(textNode, index, length, entry, sourceKind) {
  if (!textNode?.parentNode) return null;

  const matchNode = textNode.splitText(index);
  const remainderNode = matchNode.splitText(length);
  const highlight = document.createElement('mark');
  highlight.className = 'lumiread-revisit-highlight';
  highlight.dataset.lumiread = 'true';
  highlight.dataset.entryId = entry.id;
  highlight.dataset.sourceKind = sourceKind;
  highlight.title = `${entry.term} · p.${entry.sourcePage || currentPageNumber}`;
  highlight.textContent = matchNode.nodeValue;
  matchNode.parentNode.replaceChild(highlight, matchNode);

  if (!remainderNode.textContent) {
    remainderNode.remove();
  }

  return highlight;
}

function focusRevisitHighlight(highlight) {
  highlight.classList.add('lumiread-revisit-highlight--focus');
  highlight.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  setTimeout(() => {
    highlight.classList.remove('lumiread-revisit-highlight--focus');
  }, 2200);
}

function showError(message) {
  $('loading-state').classList.add('pdf-state--hidden');
  $('viewer-shell').classList.add('pdf-state--hidden');
  $('error-message').textContent = message;
  $('error-state').classList.remove('pdf-state--hidden');
}

async function resolveDocumentName(url) {
  try {
    const metadata = await pdfDocument.getMetadata();
    const title = metadata?.info?.Title?.trim();
    if (title) return title;
  } catch {
    // Fall back to URL file name.
  }

  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split('/').filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : 'document.pdf';
  } catch {
    return 'document.pdf';
  }
}

function isAllowedFileSchemeAccess() {
  return new Promise((resolve) => {
    chrome.extension.isAllowedFileSchemeAccess(resolve);
  });
}

function loadUiConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ apiKey: '', aiSummaryDepth: 'brief' }, (result) => {
      resolve({
        aiConfigured: Boolean(String(result.apiKey || '').trim()),
        aiSummaryDepth: result.aiSummaryDepth || 'brief',
      });
    });
  });
}

function getAiPanel() {
  return card?.querySelector('[data-panel="ai"]') || null;
}

function getAiTextEl() {
  return getAiPanel()?.querySelector('.lr-streaming-text') || null;
}

function isLumiReadElement(element) {
  return element?.closest?.('[data-lumiread]') !== null;
}

function isSearchableTextNode(node) {
  if (!node?.textContent?.trim()) return false;
  if (!node.parentElement) return false;
  if (node.parentElement.closest('[data-lumiread]')) return false;
  return true;
}

function dedupeEntries(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const anchor = entry.sourceAnchor || {};
    const key = [entry.term, entry.sourcePage, anchor.prefix, anchor.suffix].join('::');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSourceAnchor(term, context) {
  const quote = String(term || '').trim();
  const text = String(context || '');
  if (!quote || !text) {
    return quote ? { quote } : null;
  }

  const lowerContext = text.toLowerCase();
  const lowerQuote = quote.toLowerCase();
  const matchIndex = lowerContext.indexOf(lowerQuote);
  if (matchIndex === -1) {
    return { quote };
  }

  return {
    quote,
    prefix: text.slice(Math.max(0, matchIndex - 48), matchIndex).trim(),
    suffix: text.slice(matchIndex + quote.length, matchIndex + quote.length + 48).trim(),
    contextSnippet: text.slice(Math.max(0, matchIndex - 96), matchIndex + quote.length + 96).trim(),
  };
}

function buildPdfSourceLocator(selection, pageNumber, term) {
  try {
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    const startNode = range.startContainer;
    const page = (startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : startNode)?.closest('.page');
    const textLayer = page?.querySelector('.textLayer');
    if (!textLayer) return null;

    let absoluteOffset = 0;
    let matched = false;
    const walker = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return isSearchableTextNode(node)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node === startNode) {
        absoluteOffset += range.startOffset;
        matched = true;
        break;
      }

      absoluteOffset += (node.textContent || '').length;
    }

    if (!matched) return null;

    return {
      scope: 'pdf_page_text',
      pageNumber,
      startOffsetInBlock: absoluteOffset,
      quoteLength: String(term || '').length,
    };
  } catch {
    return null;
  }
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(str, maxLength) {
  if (!str) return '';
  return str.length > maxLength ? `${str.slice(0, maxLength)}…` : str;
}

/* ─── FAB (Floating Action Button) for PDF Note ──────────────────── */

let pdfFab = null;
let isPageNote = false;

function createPdfFab() {
  if (pdfFab) return;
  pdfFab = document.createElement('div');
  pdfFab.className = 'lr-fab';
  pdfFab.setAttribute('data-lumiread', 'true');
  pdfFab.innerHTML = `
    <button class="lr-fab-main" aria-label="LumiNote menu">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M2 17l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    </button>
    <div class="lr-fab-menu">
      <button class="lr-fab-item" data-action="settings" data-label="Settings">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
      <button class="lr-fab-item" data-action="screenshot" data-label="Screenshot">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
        </svg>
      </button>
      <button class="lr-fab-item" data-action="note" data-label="Note">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
      </button>
    </div>
  `;
  document.body.appendChild(pdfFab);

  const mainBtn = pdfFab.querySelector('.lr-fab-main');
  let fabOpen = false;

  mainBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fabOpen = !fabOpen;
    pdfFab.classList.toggle('lr-fab--open', fabOpen);
  });

  pdfFab.querySelectorAll('.lr-fab-item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      fabOpen = false;
      pdfFab.classList.remove('lr-fab--open');
      const action = btn.dataset.action;
      if (action === 'note') openPdfNote();
      else if (action === 'screenshot') startPdfScreenshot();
      else if (action === 'settings') chrome.runtime.openOptionsPage();
    });
  });

  document.addEventListener('click', (e) => {
    if (fabOpen && !isLumiReadElement(e.target)) {
      fabOpen = false;
      pdfFab.classList.remove('lr-fab--open');
    }
  });
}

/* ─── FAB: Screenshot ─────────────────────────────────────────── */

let screenshotOverlay = null;

function startPdfScreenshot() {
  if (screenshotOverlay) return;
  screenshotOverlay = document.createElement('div');
  screenshotOverlay.className = 'lr-screenshot-overlay';
  screenshotOverlay.setAttribute('data-lumiread', 'true');

  const hint = document.createElement('div');
  hint.className = 'lr-screenshot-hint';
  hint.textContent = 'Drag to select area · Press Esc to cancel';
  screenshotOverlay.appendChild(hint);

  let startX = 0, startY = 0, selBox = null, dragging = false;

  screenshotOverlay.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startX = e.clientX; startY = e.clientY; dragging = true;
    selBox = document.createElement('div');
    selBox.className = 'lr-screenshot-selection';
    screenshotOverlay.appendChild(selBox);
  });
  screenshotOverlay.addEventListener('mousemove', (e) => {
    if (!dragging || !selBox) return;
    selBox.style.left = `${Math.min(startX, e.clientX)}px`;
    selBox.style.top = `${Math.min(startY, e.clientY)}px`;
    selBox.style.width = `${Math.abs(e.clientX - startX)}px`;
    selBox.style.height = `${Math.abs(e.clientY - startY)}px`;
  });
  screenshotOverlay.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;
    const x = Math.min(startX, e.clientX), y = Math.min(startY, e.clientY);
    const w = Math.abs(e.clientX - startX), h = Math.abs(e.clientY - startY);
    removePdfScreenshotOverlay();
    if (w < 10 || h < 10) return;
    requestAnimationFrame(() => {
      setTimeout(() => capturePdfScreenshot({ x, y, w, h }), 50);
    });
  });

  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { removePdfScreenshotOverlay(); document.removeEventListener('keydown', onEsc); }
  });
  document.body.appendChild(screenshotOverlay);
}

function removePdfScreenshotOverlay() {
  if (screenshotOverlay) { screenshotOverlay.remove(); screenshotOverlay = null; }
}

function capturePdfScreenshot(region) {
  chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
    if (!response?.ok || !response.dataUrl) return;
    const img = new Image();
    img.onload = () => {
      const dpr = img.naturalWidth / window.innerWidth;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(region.w * dpr);
      canvas.height = Math.round(region.h * dpr);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img,
        Math.round(region.x * dpr), Math.round(region.y * dpr),
        canvas.width, canvas.height,
        0, 0, canvas.width, canvas.height
      );
      const croppedUrl = canvas.toDataURL('image/png');
      openPdfScreenshotCard(croppedUrl);
    };
    img.src = response.dataUrl;
  });
}

function openPdfScreenshotCard(imageDataUrl) {
  hideCard();
  isPageNote = false;
  currentSelection = sourceName || 'PDF Screenshot';
  currentContext = '';
  currentDepth = 'brief';
  currentMode = 'note';
  loadingDepths.clear();
  aiConfigured = false;

  card = document.createElement('div');
  card.className = 'lumiread-card lumiread-card--screenshot';
  card.setAttribute('data-lumiread', 'true');
  card.innerHTML = `
    <div class="lr-card-header">
      <div class="lr-logo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M2 17l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        </svg>
        <span>LumiNote</span>
      </div>
      <button class="lr-close-btn" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="lr-term">${escapeHtml(truncate(sourceName, 40))} · Screenshot</div>
    <div class="lr-screenshot-preview"><img src="${imageDataUrl}" alt="Screenshot" style="max-width:100%; border-radius:8px; margin:8px 0;"></div>
    <div class="lr-mode-row">
      <div class="lr-mode-group">
        <button class="lr-mode-btn lr-mode-btn--active" data-mode="note">Note</button>
        <button class="lr-mode-ai-btn" data-mode="ai" title="AI analyze screenshot" disabled>
          <span>AI</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z"/><path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9L18 15z"/></svg>
        </button>
      </div>
    </div>
    <div class="lr-content-area">
      <div class="lr-note-section" data-panel="note">
        <textarea id="lr-note-input" class="lr-note-input" placeholder="Notes about this screenshot..."></textarea>
      </div>
      <div class="lr-ai-panel lr-ai-panel--hidden" data-panel="ai">
        <div class="lr-ai-caption">AI will analyze the screenshot.</div>
        <div class="lr-ai-empty">No AI summary yet.</div>
        <div class="lr-streaming-text"></div>
        <div class="lr-cursor"></div>
      </div>
    </div>
    <div class="lr-card-footer">
      <button class="lr-save-btn" title="Save to notebook"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Save</button>
      <span class="lr-source-label">${escapeHtml(truncate(sourceName, 30))} · p.${currentPageNumber}</span>
    </div>
  `;

  card.style.position = 'fixed';
  card.style.left = '50%';
  card.style.top = '20%';
  card.style.transform = 'translateX(-50%)';
  document.body.appendChild(card);

  // Store image data for saving
  card._screenshotDataUrl = imageDataUrl;

  card.querySelector('.lr-close-btn').addEventListener('click', () => hideCard());
  card.querySelector('.lr-mode-btn[data-mode="note"]').addEventListener('click', () => switchMode('note'));
  card.querySelector('.lr-mode-ai-btn').addEventListener('click', () => {
    if (!aiConfigured) return;
    switchMode('ai');
    if (!getAiTextEl()?.dataset.loaded) {
      // Send screenshot for AI analysis
      chrome.runtime.sendMessage({
        type: 'PDF_EXPLAIN_REQUEST',
        selectedText: '',
        context: '',
        markType: 'screenshot',
        imageUrl: imageDataUrl,
        depth: 'brief',
        sourceTitle: sourceName,
      });
      loadingDepths.add('brief');
      const cursor = card.querySelector('.lr-cursor');
      if (cursor) cursor.classList.add('lr-cursor--active');
    }
  });
  card.querySelector('.lr-save-btn').addEventListener('click', () => {
    const aiSummary = getAiTextEl()?.dataset.raw || '';
    const note = card.querySelector('.lr-note-input')?.value.trim() || '';
    chrome.runtime.sendMessage({
      type: 'SAVE_ENTRY',
      entry: {
        entryType: 'image',
        term: `${sourceName} · Screenshot p.${currentPageNumber}`,
        context: '',
        note,
        aiSummary,
        sourceUrl: sourceUrl || location.href,
        sourceTitle: sourceName,
        imageUrl: imageDataUrl,
        imageAlt: 'PDF screenshot',
      },
    });
    const btn = card.querySelector('.lr-save-btn');
    if (btn) {
      btn.classList.add('lr-save-btn--saved');
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Saved!`;
      setTimeout(() => { if (btn) { btn.classList.remove('lr-save-btn--saved'); btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Save`; } }, 2000);
    }
  });

  hydrateAiAvailability();
  card.querySelector('.lr-note-input')?.focus();
  setTimeout(() => document.addEventListener('mousedown', onOutsideClick), 100);
}

/* ─── PDF text extraction ────────────────────────────────────── */

async function extractPdfText() {
  if (!pdfDocument) return '';
  const MAX_CHARS = 6000;
  const chunks = [];
  let total = 0;
  const numPages = pdfDocument.numPages;
  for (let i = 1; i <= numPages && total < MAX_CHARS; i++) {
    try {
      const page = await pdfDocument.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ').trim();
      if (pageText.length > 20) {
        chunks.push(pageText);
        total += pageText.length;
      }
    } catch { /* skip unreadable pages */ }
  }
  return chunks.join('\n').slice(0, MAX_CHARS);
}

function openPdfNote() {
  hideCard();
  isPageNote = true;
  currentSelection = sourceName || 'PDF Document';
  currentContext = null; // will be set async
  currentDepth = 'brief';
  currentMode = 'note';
  loadingDepths.clear();
  aiConfigured = false;

  card = document.createElement('div');
  card.className = 'lumiread-card';
  card.setAttribute('data-lumiread', 'true');
  card.innerHTML = buildPageNoteCardHTML();

  // Center the card
  card.style.position = 'fixed';
  card.style.left = '50%';
  card.style.top = '20%';
  card.style.transform = 'translateX(-50%)';

  document.body.appendChild(card);
  bindPageNoteCardEvents();
  hydrateAiAvailability();
  card.querySelector('#lr-title-input')?.focus();

  // Extract PDF text in background for AI use
  extractPdfText().then(text => { currentContext = text; });

  setTimeout(() => {
    document.addEventListener('mousedown', onOutsideClick);
  }, 100);
}

function buildPageNoteCardHTML() {
  return `
    <div class="lr-card-header">
      <div class="lr-logo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M2 17l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        </svg>
        <span>LumiNote</span>
      </div>
      <button class="lr-close-btn" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>

    <input id="lr-title-input" class="lr-title-input" value="${escapeHtml(sourceName || 'PDF Document')}" placeholder="Title" />

    <div class="lr-mode-row">
      <div class="lr-mode-group">
        <button class="lr-mode-btn lr-mode-btn--active" data-mode="note">Note</button>
        <button class="lr-mode-ai-btn" data-mode="ai" title="Generate AI summary" disabled>
          <span>AI</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z"/>
            <path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9L18 15z"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="lr-content-area">
      <div class="lr-note-section" data-panel="note">
        <label class="lr-note-label" for="lr-note-input">Note</label>
        <textarea id="lr-note-input" class="lr-note-input" placeholder="Write notes about this PDF..."></textarea>
      </div>
      <div class="lr-ai-panel lr-ai-panel--hidden" data-panel="ai">
        <div class="lr-ai-caption">AI will summarize the full PDF content.</div>
        <div class="lr-ai-empty">No AI summary yet.</div>
        <div class="lr-streaming-text"></div>
        <div class="lr-cursor"></div>
        <div class="lr-related-section lr-hidden"></div>
      </div>
    </div>

    <div class="lr-card-footer">
      <button class="lr-save-btn" title="Save to notebook">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        Save
      </button>
      <span class="lr-source-label" title="${escapeHtml(sourceName)}">${escapeHtml(truncate(sourceName, 40))}</span>
    </div>
  `;
}

function bindPageNoteCardEvents() {
  card.querySelector('.lr-close-btn').addEventListener('click', () => {
    isPageNote = false;
    hideCard();
  });

  card.querySelector('.lr-mode-btn[data-mode="note"]').addEventListener('click', () => switchMode('note'));

  card.querySelector('.lr-mode-ai-btn').addEventListener('click', () => {
    if (!aiConfigured) return;
    switchMode('ai');
    if (!loadingDepths.has(currentDepth) && !getAiTextEl()?.dataset.loaded) {
      requestPageNoteExplanation();
    }
  });

  card.querySelector('.lr-save-btn').addEventListener('click', () => savePageNote());
}

function requestPageNoteExplanation() {
  if (!currentContext) {
    // PDF text still loading
    const textEl = getAiTextEl();
    if (textEl) textEl.innerHTML = '<em>Extracting PDF text...</em>';
    extractPdfText().then(text => {
      currentContext = text;
      if (currentContext) sendPageNoteExplainRequest();
    });
    return;
  }
  sendPageNoteExplainRequest();
}

function sendPageNoteExplainRequest() {
  const depth = currentDepth;
  loadingDepths.add(depth);
  const textEl = getAiTextEl();
  const cursor = card?.querySelector('.lr-cursor');
  if (textEl) { textEl.textContent = ''; textEl.dataset.raw = ''; delete textEl.dataset.loaded; }
  if (cursor) cursor.classList.add('lr-cursor--active');

  chrome.runtime.sendMessage({
    type: 'PDF_EXPLAIN_REQUEST',
    selectedText: currentContext || '',
    context: '',
    markType: 'text',
    depth,
    sourceTitle: sourceName,
  });
}

function savePageNote() {
  const aiSummary = getAiTextEl()?.dataset.raw || '';
  const note = card?.querySelector('.lr-note-input')?.value.trim() || '';
  const titleInput = card?.querySelector('#lr-title-input');
  const title = titleInput?.value.trim() || sourceName;

  chrome.runtime.sendMessage({
    type: 'SAVE_ENTRY',
    entry: {
      entryType: 'text',
      term: title,
      context: currentContext || '',
      note,
      aiSummary,
      sourceUrl: sourceUrl || location.href,
      sourceTitle: sourceName,
      sourceAnchor: null,
      sourceLocator: null,
    },
  });

  const button = card?.querySelector('.lr-save-btn');
  if (button) {
    button.classList.add('lr-save-btn--saved');
    button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Saved!`;
    setTimeout(() => {
      if (button) {
        button.classList.remove('lr-save-btn--saved');
        button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg> Save`;
      }
    }, 2000);
  }
}

function renderMarkdownLite(text) {
  if (!text) return '';
  const s = escapeHtml(text);
  const html = s
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (/^#{1,3}\s+/.test(trimmed)) {
        return `<strong class="lr-md-heading">${trimmed.replace(/^#{1,3}\s+/, '')}</strong>`;
      }
      if (/^[-*]{3,}$/.test(trimmed)) return '';
      if (/^[-*]\s+/.test(trimmed)) {
        return `<span class="lr-md-li">\u2022 ${trimmed.replace(/^[-*]\s+/, '')}</span>`;
      }
      if (/^\d+\.\s+/.test(trimmed)) {
        return `<span class="lr-md-li">${trimmed}</span>`;
      }
      if (/^\|.+\|$/.test(trimmed)) {
        if (/^\|[\s\-:|]+\|$/.test(trimmed)) return '';
        const cells = trimmed.slice(1, -1).split('|').map((c) => c.trim());
        return `<span class="lr-md-tr">${cells.join(' \u00b7 ')}</span>`;
      }
      if (trimmed === '') return '\n';
      return line;
    })
    .join('\n')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="lr-md-code">$1</code>')
    .replace(/\n{2,}/g, '<br>')
    .replace(/\n/g, '<br>')
    .replace(/(<\/strong>|<\/span>)<br>/g, '$1')
    .replace(/^(<br>)+|(<br>)+$/g, '');
  return html;
}

