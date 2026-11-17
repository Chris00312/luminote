/**
 * LumiRead — Content Script
 * Handles: text selection, bubble trigger, floating explanation card.
 */

(async function () {
  'use strict';

  /* ─── i18n ──────────────────────────────────────────────────────── */
  let _t = (key) => key; // fallback until i18n loads
  try {
    const i18n = await import(chrome.runtime.getURL('lib/i18n.js'));
    await i18n.initLocale();
    _t = i18n.t;
  } catch (_) { /* i18n unavailable — use key as fallback */ }
  const t = _t;

  /* ─── State ─────────────────────────────────────────────────────── */
  let bubble = null;
  let card = null;
  let currentMark = null;
  let currentDepth = 'brief';
  let currentMode = 'note';
  let aiConfigured = false;
  let lastImageContextMenu = null;
  let autoSavedEntryId = null;
  let _pendingAiSummary = null;
  const loadingDepths = new Set();
  const revisitHighlights = [];
  const revisitHighlightKeys = new Set();

  chrome.runtime.sendMessage({ type: 'ENSURE_CONTEXT_MENUS' }, () => {
    void chrome.runtime.lastError;
  });

  initRevisitHighlights();

  /* ─── Text selection detection ──────────────────────────────────── */

  // Shared logic: detect selection → show/hide bubble
  function checkSelectionAndBubble() {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length > 1 && text.length < 500) {
      currentMark = createTextMark({
        text,
        context: extractContext(selection),
        locator: buildTextSourceLocator(selection, text),
      });
      showBubble(selection);
    } else {
      hideBubble();
    }
  }

  // Primary: mouseup (works for most click-drag)
  document.addEventListener('mouseup', (e) => {
    if (isLumiReadElement(e.target)) return;
    setTimeout(checkSelectionAndBubble, 10);
  });

  // Fallback: selectionchange — catches Mac trackpad two-finger selection
  // and any case where mouseup doesn't fire or fires too early.
  let _selChangeTimer = null;
  document.addEventListener('selectionchange', () => {
    clearTimeout(_selChangeTimer);
    _selChangeTimer = setTimeout(() => {
      // Skip if bubble already visible or card is open
      if (bubble || card) return;
      checkSelectionAndBubble();
    }, 350);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideBubble();
      hideCard();
    }
  });

  document.addEventListener('contextmenu', (event) => {
    const imageEl = findContextMenuImage(event);
    if (!imageEl) {
      lastImageContextMenu = null;
      return;
    }

    const imageUrl = normalizeComparableUrl(imageEl.currentSrc || imageEl.src || '');
    if (!imageUrl) {
      lastImageContextMenu = null;
      return;
    }

    lastImageContextMenu = {
      imageUrl,
      clientX: event.clientX,
      clientY: event.clientY,
      timestamp: Date.now(),
    };
  }, true);

  // Listen for shortcut trigger from background
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'SHORTCUT_TRIGGER') {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      if (text && text.length > 1) {
        currentMark = createTextMark({
          text,
          context: extractContext(selection),
          locator: buildTextSourceLocator(selection, text),
        });
        hideBubble();
        openCard();
      }
    }

    if (message.type === 'OPEN_IMAGE_MARK_CARD') {
      currentMark = createImageMark(message);
      hideBubble();
      openCard(currentMark.anchorRect || null);
      sendResponse?.({ ok: true });
      return;
    }

    if (message.type === 'EXPLAIN_CHUNK') {
      handleChunk(message.chunk, message.depth);
    }

    if (message.type === 'EXPLAIN_DONE') {
      handleDone(message.fullText, message.depth, message.related, message.tags);
    }

    if (message.type === 'EXPLAIN_ERROR') {
      handleError(message.error, message.depth);
    }

    if (message.type === 'REFRESH_REVISIT_HIGHLIGHTS') {
      initRevisitHighlights();
    }
  });

  /* ─── Context extraction ────────────────────────────────────────── */

  function extractContext(selection) {
    try {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const paragraph =
        container.nodeType === Node.TEXT_NODE
          ? container.parentElement
          : container;

      // Walk up to find a meaningful block element
      let block = paragraph;
      const blockTags = ['P', 'DIV', 'SECTION', 'ARTICLE', 'LI', 'TD', 'BLOCKQUOTE'];
      while (block && !blockTags.includes(block.tagName)) {
        block = block.parentElement;
      }

      const text = (block || paragraph)?.innerText || '';
      // Return up to 600 chars of context
      return text.slice(0, 600);
    } catch {
      return '';
    }
  }

  function createTextMark({ text, context, locator }) {
    return {
      kind: 'text',
      label: String(text || '').trim(),
      title: String(text || '').trim(),
      context: String(context || ''),
      sourceLocator: locator || null,
      sourceUrl: location.href,
      sourceTitle: document.title,
    };
  }

  function createImageMark({ imageUrl, pageUrl, pageTitle }) {
    const imageEl = findImageElementByUrl(imageUrl);
    const imageAlt = imageEl?.getAttribute('alt')?.trim() || '';
    const context = buildImageContext(imageEl, imageAlt);
    const fallbackTitle = imageAlt || getImageFileName(imageUrl) || 'Image mark';
    const anchorRect = getImageAnchorRect(imageUrl, imageEl);

    return {
      kind: 'image',
      label: fallbackTitle,
      title: fallbackTitle,
      context,
      sourceUrl: pageUrl || location.href,
      sourceTitle: pageTitle || document.title,
      imageUrl,
      imageAlt,
      anchorRect,
    };
  }

  function findContextMenuImage(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    const pathImage = path.find((node) => node?.tagName === 'IMG');
    if (pathImage) return pathImage;
    return event.target?.closest?.('img') || null;
  }

  function findImageElementByUrl(targetUrl) {
    if (!targetUrl) return null;
    const normalizedTarget = normalizeComparableUrl(targetUrl);
    const images = Array.from(document.images || []);

    return images.find((image) => {
      const candidates = [image.currentSrc, image.src]
        .filter(Boolean)
        .map((value) => normalizeComparableUrl(value));
      return candidates.includes(normalizedTarget);
    }) || null;
  }

  function buildImageContext(imageEl, imageAlt) {
    const parts = [];
    const caption = imageEl?.closest('figure')?.querySelector('figcaption')?.innerText?.trim() || '';
    const nearby = imageEl
      ? findMeaningfulBlock(imageEl.parentElement || null)?.innerText?.trim() || ''
      : '';

    if (caption) parts.push(caption);
    if (imageAlt) parts.push(imageAlt);
    if (nearby) parts.push(nearby);

    const combined = parts
      .map((part) => String(part || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ');

    return combined.slice(0, 600);
  }

  function getImageAnchorRect(imageUrl, imageEl) {
    const normalizedTarget = normalizeComparableUrl(imageUrl);
    const hasRecentContextMenu = lastImageContextMenu
      && lastImageContextMenu.imageUrl === normalizedTarget
      && Date.now() - lastImageContextMenu.timestamp < 15000;

    if (hasRecentContextMenu) {
      const { clientX, clientY } = lastImageContextMenu;
      return {
        left: clientX,
        right: clientX,
        top: clientY,
        bottom: clientY,
      };
    }

    return imageEl?.getBoundingClientRect?.() || null;
  }

  function normalizeComparableUrl(url) {
    try {
      const parsed = new URL(url, location.href);
      parsed.hash = '';
      return parsed.toString();
    } catch {
      return String(url || '').split('#')[0];
    }
  }

  function getImageFileName(url) {
    try {
      const parsed = new URL(url, location.href);
      const fileName = parsed.pathname.split('/').filter(Boolean).pop();
      return fileName ? decodeURIComponent(fileName) : '';
    } catch {
      return '';
    }
  }

  /* ─── Bubble ────────────────────────────────────────────────────── */

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

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    bubble.style.left = `${rect.right + scrollX}px`;
    bubble.style.top = `${rect.top + scrollY - 36}px`;

    bubble.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideBubble();
      openCard(rect);
    });

    document.body.appendChild(bubble);

    // Adjust if off screen
    requestAnimationFrame(() => {
      const bRect = bubble.getBoundingClientRect();
      if (bRect.right > window.innerWidth - 10) {
        bubble.style.left = `${rect.left + scrollX}px`;
        bubble.style.transform = 'translateX(-100%)';
      }
    });
  }

  function hideBubble() {
    if (bubble) {
      bubble.remove();
      bubble = null;
    }
  }

  /* ─── Card ──────────────────────────────────────────────────────── */

  /* ── Scroll-lock: block page scroll while card is open ─────────── */
  function _lockPageScroll(e) {
    // Allow scroll inside the card itself
    if (card && card.contains(e.target)) return;
    e.preventDefault();
  }
  function enableScrollLock() {
    document.addEventListener('wheel', _lockPageScroll, { passive: false });
    document.addEventListener('touchmove', _lockPageScroll, { passive: false });
  }
  function disableScrollLock() {
    document.removeEventListener('wheel', _lockPageScroll);
    document.removeEventListener('touchmove', _lockPageScroll);
  }

  function openCard(selectionRect) {
    hideCard();
    if (!currentMark) return;

    currentDepth = 'brief';
    currentMode = 'note';
    loadingDepths.clear();
    aiConfigured = false;

    card = document.createElement('div');
    card.className = 'lumiread-card';
    card.setAttribute('data-lumiread', 'true');
    card.innerHTML = buildCardHTML(currentMark);

    // Position near selection
    positionCard(selectionRect);
    document.body.appendChild(card);

    // Lock page scroll, redirect to card content
    enableScrollLock();

    // Bind card events
    bindCardEvents();
    hydrateAiAvailability();

    if (currentMark?.kind === 'page-note') {
      card.querySelector('#lr-title-input')?.focus();
    } else {
      card.querySelector('.lr-note-input')?.focus();
    }

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('mousedown', onOutsideClick);
    }, 100);
  }

  function positionCard() {
    // Position is handled entirely by CSS (.lumiread-card: fixed, centered)
    // Nothing to do here — kept as a no-op so call sites don't break.
  }

  function hideCard() {
    disableScrollLock();
    autoSavedEntryId = null;
    _pendingAiSummary = null;
    _pendingAiTags = [];
    if (card) {
      card.classList.add('lumiread-card--exit');
      setTimeout(() => { card?.remove(); card = null; }, 200);
    }
    document.removeEventListener('mousedown', onOutsideClick);
  }

  function onOutsideClick(e) {
    if (!isLumiReadElement(e.target)) {
      hideCard();
    }
  }

  /* ─── Card HTML ─────────────────────────────────────────────────── */

  function buildCardHTML(term) {
    const title = term.kind === 'image' ? term.title : term.label;
    const sourceLabel = term.sourceTitle || document.title;
    const isPageNote = term.kind === 'page-note';
    const imagePreview = term.kind === 'image'
      ? `
      <button class="lr-image-preview" type="button" title="Open image in new tab">
        <img src="${escapeHtml(term.imageUrl)}" alt="${escapeHtml(term.imageAlt || title)}">
        <span class="lr-image-preview__meta">${escapeHtml(term.imageAlt || 'Saved image')}</span>
      </button>
    `
      : '';

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

      ${isPageNote
        ? `<input id="lr-title-input" class="lr-title-input" type="text" value="${escapeHtml(title)}" placeholder="Title…" maxlength="200">`
        : `<div class="lr-term">${escapeHtml(title)}</div>`
      }
      ${imagePreview}

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
        <span class="lr-source-label" title="${escapeHtml(document.title)}">
          ${escapeHtml(truncate(sourceLabel, 30))}
        </span>
      </div>
    `;
  }

  /* ─── Card event binding ────────────────────────────────────────── */

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

    card.querySelector('.lr-image-preview')?.addEventListener('click', () => {
      if (!currentMark?.imageUrl) return;
      window.open(currentMark.imageUrl, '_blank', 'noopener,noreferrer');
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

  /* ─── Streaming handlers ────────────────────────────────────────── */

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

    const isVisual = currentMark?.kind === 'image' || currentMark?.kind === 'screenshot';
    chrome.runtime.sendMessage({
      type: 'EXPLAIN_REQUEST',
      markType: currentMark?.kind || 'text',
      selectedText: currentMark?.label || '',
      context: currentMark?.context || '',
      imageUrl: isVisual ? currentMark.imageUrl : '',
      imageAlt: isVisual ? currentMark.imageAlt || '' : '',
      sourceTitle: currentMark?.sourceTitle || document.title,
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
    // Append chunk, convert newlines to <br>
    textEl.innerHTML = renderMarkdownLite(textEl.dataset.raw + chunk);
    textEl.dataset.raw = (textEl.dataset.raw || '') + chunk;
  }

  let _pendingAiTags = [];

  function handleDone(fullText, depth, related, tags) {
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

    // Store AI summary + tags for manual save (user clicks Save button)
    if (fullText) {
      _pendingAiSummary = fullText;
    }
    _pendingAiTags = tags || [];

    if (depth === 'deep' && related?.length > 0) {
      const relatedEl = panelEl.querySelector('.lr-related-section');
      relatedEl.classList.remove('lr-hidden');
      relatedEl.innerHTML = `
        <div class="lr-related-title">Related concepts</div>
        <div class="lr-related-tags">
          ${related.map((t) => `<button class="lr-related-tag">${escapeHtml(t)}</button>`).join('')}
        </div>
      `;
      relatedEl.querySelectorAll('.lr-related-tag').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentMark = createTextMark({
            text: btn.textContent,
            context: '',
            locator: null,
          });
          currentMode = 'ai';
          card.querySelector('.lr-term').textContent = btn.textContent;
          loadingDepths.clear();
          const aiPanel = getAiPanel();
          const te = aiPanel.querySelector('.lr-streaming-text');
          te.textContent = '';
          te.dataset.raw = '';
          delete te.dataset.loaded;
          const rs = aiPanel.querySelector('.lr-related-section');
          rs.classList.add('lr-hidden');
          rs.innerHTML = '';
          switchMode('ai');
          requestExplanation(currentDepth);
        });
      });
    }
  }

  function handleError(error, depth) {
    const errorDepth = depth || currentDepth;
    loadingDepths.delete(errorDepth);
    if (!card) return;
    if (errorDepth !== currentDepth) return;
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

  /* ─── Save to notebook ──────────────────────────────────────────── */

  function saveToNotebook() {
    const aiSummary = getAiTextEl()?.dataset.raw || '';
    const note = card?.querySelector('.lr-note-input')?.value.trim() || '';

    // For page-note, read editable title input
    if (currentMark?.kind === 'page-note') {
      const titleInput = card?.querySelector('#lr-title-input');
      if (titleInput) currentMark.label = titleInput.value.trim() || currentMark.label;
    }

    const isImage = currentMark?.kind === 'image' || currentMark?.kind === 'screenshot';

    const entryData = {
      entryType: isImage ? 'image' : 'text',
      term: currentMark?.label || '',
      context: currentMark?.context || '',
      note,
      aiSummary,
      tags: _pendingAiTags.length ? _pendingAiTags : [],
      sourceUrl: currentMark?.sourceUrl || location.href,
      sourceTitle: currentMark?.sourceTitle || document.title,
      sourceAnchor: currentMark?.kind === 'text'
        ? buildSourceAnchor(currentMark.label, currentMark.context)
        : null,
      sourceLocator: currentMark?.kind === 'text' ? currentMark.sourceLocator || null : null,
      imageUrl: isImage ? currentMark.imageUrl || '' : '',
      imageAlt: isImage ? currentMark.imageAlt || '' : '',
    };

    if (autoSavedEntryId) {
      // Update the existing auto-saved entry instead of creating a duplicate
      chrome.runtime.sendMessage({
        type: 'UPDATE_ENTRY',
        id: autoSavedEntryId,
        updates: entryData,
      });
    } else {
      chrome.runtime.sendMessage({
        type: 'SAVE_ENTRY',
        entry: entryData,
      }, (response) => {
        if (response?.ok && response.id) {
          autoSavedEntryId = response.id;
        }
      });
    }

    // Show saved feedback
    const btn = card?.querySelector('.lr-save-btn');
    if (btn) {
      btn.classList.add('lr-save-btn--saved');
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        Saved!
      `;
      setTimeout(() => {
        if (btn) {
          btn.classList.remove('lr-save-btn--saved');
          btn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
            Save
          `;
        }
      }, 2000);
    }
  }

  /* ─── Auto-save (无感积累) ──────────────────────────────────────── */

  function autoSaveEntry(options = {}) {
    const isImage = currentMark?.kind === 'image' || currentMark?.kind === 'screenshot';
    const aiSummary = options.aiSummary || '';
    const note = card?.querySelector('.lr-note-input')?.value.trim() || '';

    const entryData = {
      entryType: isImage ? 'image' : 'text',
      term: currentMark?.label || '',
      context: currentMark?.context || '',
      note,
      aiSummary,
      sourceUrl: currentMark?.sourceUrl || location.href,
      sourceTitle: currentMark?.sourceTitle || document.title,
      sourceAnchor: currentMark?.kind === 'text'
        ? buildSourceAnchor(currentMark.label, currentMark.context)
        : null,
      sourceLocator: currentMark?.kind === 'text' ? currentMark.sourceLocator || null : null,
      imageUrl: isImage ? currentMark.imageUrl || '' : '',
      imageAlt: isImage ? currentMark.imageAlt || '' : '',
    };

    if (autoSavedEntryId) {
      // Update existing auto-saved entry
      chrome.runtime.sendMessage({
        type: 'UPDATE_ENTRY',
        id: autoSavedEntryId,
        updates: entryData,
      });
      showAutoSaveToast(options.toastMessage || '\u5df2\u66f4\u65b0\u8bb0\u5fc6\u5e93', () => {
        chrome.runtime.sendMessage({ type: 'DELETE_ENTRY', id: autoSavedEntryId });
        autoSavedEntryId = null;
      });
    } else {
      // Create new entry
      chrome.runtime.sendMessage({
        type: 'SAVE_ENTRY',
        entry: entryData,
      }, (response) => {
        if (response?.ok && response.id) {
          autoSavedEntryId = response.id;
        }
      });
      showAutoSaveToast(options.toastMessage || '\u5df2\u5b58\u5165\u8bb0\u5fc6\u5e93', () => {
        if (autoSavedEntryId) {
          chrome.runtime.sendMessage({ type: 'DELETE_ENTRY', id: autoSavedEntryId });
          autoSavedEntryId = null;
        }
      });
    }
  }

  function showAutoSaveToast(message, onUndo) {
    // Remove any existing toast
    document.querySelector('.luminote-autosave-toast')?.remove();

    const toast = document.createElement('div');
    toast.className = 'luminote-autosave-toast';
    toast.setAttribute('data-lumiread', 'true');
    toast.innerHTML = `
      <span class="luminote-toast-msg">${escapeHtml(message)}</span>
      <button class="luminote-toast-undo">Undo</button>
    `;

    Object.assign(toast.style, {
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      background: '#1a6b4a', color: '#fff', padding: '10px 20px', borderRadius: '8px',
      fontSize: '14px', fontFamily: 'system-ui, sans-serif', zIndex: '2147483647',
      display: 'flex', alignItems: 'center', gap: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      animation: 'luminote-toast-in 0.3s ease',
    });

    const undoBtn = toast.querySelector('.luminote-toast-undo');
    Object.assign(undoBtn.style, {
      background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
      padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
    });

    undoBtn.addEventListener('click', () => {
      onUndo();
      toast.remove();
    });

    document.body.appendChild(toast);

    // Add animation keyframes if not present
    if (!document.querySelector('#luminote-toast-style')) {
      const style = document.createElement('style');
      style.id = 'luminote-toast-style';
      style.textContent = `
        @keyframes luminote-toast-in { from { opacity:0; transform: translateX(-50%) translateY(20px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }
        @keyframes luminote-toast-out { from { opacity:1; } to { opacity:0; transform: translateX(-50%) translateY(20px); } }
      `;
      document.head.appendChild(style);
    }

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'luminote-toast-out 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
      }
    }, 3000);
  }

  /* ─── Helpers ───────────────────────────────────────────────────── */

  function isLumiReadElement(el) {
    return el?.closest?.('[data-lumiread]') !== null;
  }

  async function hydrateAiAvailability() {
    const config = await loadUiConfig();
    aiConfigured = config.aiConfigured;
    currentDepth = config.aiSummaryDepth;
    if (!card) return;

    const button = card.querySelector('.lr-mode-ai-btn');
    if (!button) return;

    // BYOK-only: enable the AI button when a key is configured
    aiConfigured = true;
    button.disabled = !config.hasApiKey;
    const isVisual = currentMark?.kind === 'image' || currentMark?.kind === 'screenshot';
    button.title = aiConfigured
      ? `Generate AI ${isVisual ? 'visual ' : ''}summary (${currentDepth})`
      : 'Configure an AI API key in settings to use AI summaries';
    button.setAttribute('aria-label', button.title);
  }

  function loadUiConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ apiKey: '', aiSummaryDepth: 'brief' }, (result) => {
        const hasKey = Boolean(String(result.apiKey || '').trim());
        resolve({
          aiConfigured: hasKey,
          hasApiKey: hasKey,
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

  async function initRevisitHighlights() {
    if (window.top !== window || !document.body) return;

    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'GET_REVISIT_ENTRIES',
        sourceUrl: location.href,
        sourceKind: 'web',
        limit: 20,
      }, (result) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, entries: [] });
          return;
        }
        resolve(result || { ok: false, entries: [] });
      });
    });

    if (!response?.ok || !response.entries?.length) return;

    requestAnimationFrame(() => {
      const highlights = applyRevisitHighlights(response.entries);
      const firstHighlight = highlights.find(Boolean);
      if (firstHighlight) {
        focusRevisitHighlight(firstHighlight);
      }
    });
  }

  function applyRevisitHighlights(entries) {
    const uniqueEntries = dedupeEntries(entries);
    const highlights = [];

    for (const entry of uniqueEntries) {
      const highlight = highlightSavedEntry(entry);
      if (highlight) {
        highlights.push(highlight);
      }
    }

    return highlights;
  }

  function dedupeEntries(entries) {
    const seen = new Set();
    return entries.filter((entry) => {
      const anchor = entry.sourceAnchor || {};
      const key = [entry.term, entry.sourceUrl, anchor.prefix, anchor.suffix].join('::');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function highlightSavedEntry(entry) {
    if (entry.entryType === 'image') return null;
    const term = String(entry.term || '').trim();
    if (!term) return null;

    const preciseMatch = findPreciseTextCandidate(entry, term);
    if (preciseMatch) {
      const preciseKey = `${entry.id}:${preciseMatch.blockPath}:${preciseMatch.index}`;
      if (!revisitHighlightKeys.has(preciseKey)) {
        const highlight = wrapTextMatch(preciseMatch.node, preciseMatch.index, term.length, entry, 'web');
        if (highlight) {
          revisitHighlightKeys.add(preciseKey);
          revisitHighlights.push(highlight);
          return highlight;
        }
      }
    }

    const candidate = findBestTextCandidate(document.body, term, entry);
    if (!candidate) return null;

    const matchKey = `${entry.id}:${candidate.blockPath}:${candidate.index}`;
    if (revisitHighlightKeys.has(matchKey)) return null;

    const highlight = wrapTextMatch(candidate.node, candidate.index, term.length, entry, 'web');
    if (!highlight) return null;

    revisitHighlightKeys.add(matchKey);
    revisitHighlights.push(highlight);
    return highlight;
  }

  function findPreciseTextCandidate(entry, term) {
    const locator = entry.sourceLocator || null;
    if (!locator?.blockPath || !Number.isFinite(locator.startOffsetInBlock)) {
      return null;
    }

    const block = resolveElementPath(locator.blockPath);
    if (!block) return null;

    const targetOffset = locator.startOffsetInBlock;
    const termLower = term.toLowerCase();
    let absoluteOffset = 0;
    let best = null;

    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
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
          return {
            node,
            index,
            blockPath: locator.blockPath,
          };
        }

        const distance = Math.abs(matchOffset - targetOffset);
        if (!best || distance < best.distance) {
          best = {
            node,
            index,
            distance,
            blockPath: locator.blockPath,
          };
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
        const block = findMeaningfulBlock(node.parentElement);
        const score = scoreCandidate(block, entry);

        if (!best || score > best.score) {
          best = {
            node,
            index,
            score,
            blockPath: buildElementPath(block),
          };
        }

        index = lower.indexOf(termLower, index + term.length);
      }
    }

    return best;
  }

  function scoreCandidate(block, entry) {
    const blockText = normalizeText(block?.innerText || block?.textContent || '');
    const anchor = entry.sourceAnchor || {};
    let score = 1;

    const contextSnippet = normalizeText(anchor.contextSnippet || entry.context || '');
    const prefix = normalizeText(anchor.prefix || '');
    const suffix = normalizeText(anchor.suffix || '');

    if (contextSnippet && blockText.includes(contextSnippet)) score += 8;
    if (prefix && blockText.includes(prefix)) score += 3;
    if (suffix && blockText.includes(suffix)) score += 3;
    if (block?.matches?.('p, li, blockquote, td, th')) score += 1;
    if (block?.matches?.('article, section, main')) score += 0.5;

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
    highlight.title = entry.term;
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

  function isSearchableTextNode(node) {
    if (!node?.textContent?.trim()) return false;
    if (!node.parentElement) return false;
    if (node.parentElement.closest('[data-lumiread], script, style, noscript, textarea, input, select, option')) {
      return false;
    }
    return true;
  }

  function findMeaningfulBlock(element) {
    const blockTags = ['P', 'LI', 'BLOCKQUOTE', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'ARTICLE', 'SECTION', 'MAIN', 'DIV'];
    let current = element;

    while (current && current !== document.body) {
      if (blockTags.includes(current.tagName)) {
        return current;
      }
      current = current.parentElement;
    }

    return element || document.body;
  }

  function buildElementPath(element) {
    if (!element) return '';
    const parts = [];
    let current = element;

    while (current && current !== document.body) {
      const tag = current.tagName?.toLowerCase() || 'node';
      const siblings = current.parentElement
        ? Array.from(current.parentElement.children).filter((child) => child.tagName === current.tagName)
        : [current];
      const index = siblings.indexOf(current);
      parts.unshift(`${tag}:${index}`);
      current = current.parentElement;
    }

    return parts.join('/');
  }

  function resolveElementPath(path) {
    if (!path) return null;
    const parts = String(path).split('/').filter(Boolean);
    let current = document.body;

    for (const part of parts) {
      const [tagName, rawIndex] = part.split(':');
      const index = Number(rawIndex);
      if (!tagName || !Number.isInteger(index) || !current) {
        return null;
      }

      const siblings = Array.from(current.children).filter((child) => child.tagName?.toLowerCase() === tagName);
      current = siblings[index] || null;
    }

    return current;
  }

  function buildTextSourceLocator(selection, term) {
    try {
      const range = selection.getRangeAt(0);
      const startNode = range.startContainer;
      const startOffset = range.startOffset;
      const anchorElement = startNode.nodeType === Node.TEXT_NODE ? startNode.parentElement : startNode;
      const block = findMeaningfulBlock(anchorElement);
      if (!block) return null;

      let absoluteOffset = 0;
      let matched = false;
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return isSearchableTextNode(node)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      });

      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node === startNode) {
          absoluteOffset += startOffset;
          matched = true;
          break;
        }

        absoluteOffset += (node.textContent || '').length;
      }

      if (!matched) return null;

      return {
        blockPath: buildElementPath(block),
        startOffsetInBlock: absoluteOffset,
        quoteLength: String(term || '').length,
      };
    } catch {
      return null;
    }
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

  function normalizeText(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
  }

  /**
   * Lightweight markdown → HTML (XSS-safe: escapes first, then formats).
   * Supports: ## headings, **bold**, `code`, lists, tables, hr, line breaks.
   */
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

  /* ─── FAB (Floating Action Button) ──────────────────────────────── */

  let fab = null;
  let fabOpen = false;
  let screenshotOverlay = null;

  function createFab() {
    if (fab || window.top !== window) return;

    fab = document.createElement('div');
    fab.className = 'lr-fab';
    fab.setAttribute('data-lumiread', 'true');
    fab.innerHTML = `
      <button class="lr-fab-main" aria-label="LumiNote menu">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </button>
      <div class="lr-fab-menu">
        <button class="lr-fab-item" data-action="settings" data-label="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <button class="lr-fab-item" data-action="screenshot" data-label="Screenshot">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
        <button class="lr-fab-item" data-action="note" data-label="Note">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
          </svg>
        </button>
      </div>
    `;

    document.body.appendChild(fab);

    // ── Restore saved position ──────────────────────────────────────
    try {
      const saved = localStorage.getItem('_lumi_fab_pos');
      if (saved) {
        const { left, top, docked } = JSON.parse(saved);
        fab.style.right  = 'auto';
        fab.style.bottom = 'auto';
        fab.style.left   = Math.min(Math.max(0, left), window.innerWidth  - 56) + 'px';
        fab.style.top    = Math.min(Math.max(0, top),  window.innerHeight - 56) + 'px';
        // F2: restore edge-dock state
        if (docked === 'left') fab.classList.add('lr-fab--docked-left');
        else if (docked === 'right') fab.classList.add('lr-fab--docked-right');
      }
    } catch {}

    // ── Draggable main button ───────────────────────────────────────
    {
      const mainBtn = fab.querySelector('.lr-fab-main');
      let isDown     = false;   // true only between pointerdown and pointerup
      let isDragging = false;
      let didDrag    = false;
      let dragPid    = -1;
      let downX = 0, downY = 0;
      let startLeft = 0, startTop = 0;

      function stopDrag() {
        isDown     = false;
        isDragging = false;
        dragPid    = -1;
        fab.classList.remove('lr-fab--dragging');
      }

      mainBtn.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        isDown     = true;
        isDragging = false;
        dragPid    = e.pointerId;
        downX      = e.clientX;
        downY      = e.clientY;
        const rect = fab.getBoundingClientRect();
        startLeft  = rect.left;
        startTop   = rect.top;
        mainBtn.setPointerCapture(e.pointerId);
        e.preventDefault();
      });

      mainBtn.addEventListener('pointermove', (e) => {
        if (!isDown || e.pointerId !== dragPid) return;
        const dx = e.clientX - downX;
        const dy = e.clientY - downY;
        if (!isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
          isDragging = true;
          fab.style.right  = 'auto';
          fab.style.bottom = 'auto';
          fab.classList.add('lr-fab--dragging');
          closeFab();
        }
        if (isDragging) {
          fab.style.left = Math.min(Math.max(0, startLeft + dx), window.innerWidth  - fab.offsetWidth)  + 'px';
          fab.style.top  = Math.min(Math.max(0, startTop  + dy), window.innerHeight - fab.offsetHeight) + 'px';
        }
      });

      mainBtn.addEventListener('pointerup', (e) => {
        if (!isDown || e.pointerId !== dragPid) return;
        mainBtn.releasePointerCapture(dragPid);
        if (isDragging) {
          didDrag = true;
          // F2: edge-dock. If drag finishes within 30px of left or right edge,
          // snap the FAB flush against that edge and add a class so CSS can
          // half-hide it; hovering brings it fully back.
          const leftPx  = parseFloat(fab.style.left);
          const rightGap = window.innerWidth - leftPx - fab.offsetWidth;
          const EDGE = 30;
          fab.classList.remove('lr-fab--docked-left', 'lr-fab--docked-right');
          if (leftPx < EDGE) {
            fab.style.left = '0px';
            fab.classList.add('lr-fab--docked-left');
          } else if (rightGap < EDGE) {
            fab.style.left = (window.innerWidth - fab.offsetWidth) + 'px';
            fab.classList.add('lr-fab--docked-right');
          }
          try {
            localStorage.setItem('_lumi_fab_pos', JSON.stringify({
              left: parseFloat(fab.style.left),
              top:  parseFloat(fab.style.top),
              docked: fab.classList.contains('lr-fab--docked-left') ? 'left'
                    : fab.classList.contains('lr-fab--docked-right') ? 'right'
                    : null,
            }));
          } catch {}
        }
        stopDrag();
      });

      // Cancel (e.g. touch interrupted) — clean up
      mainBtn.addEventListener('pointercancel', stopDrag);

      // Click only fires when not a drag
      mainBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (didDrag) { didDrag = false; return; }
        toggleFab();
      });
    }

    // Sub-button handlers
    fab.querySelectorAll('.lr-fab-item').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        closeFab();

        if (action === 'note') {
          fabOpenNote();
        } else if (action === 'screenshot') {
          fabStartScreenshot();
        } else if (action === 'settings') {
          fabOpenSettings();
        }
      });
    });

    // Close FAB when clicking outside
    document.addEventListener('click', (e) => {
      if (fabOpen && !isLumiReadElement(e.target)) {
        closeFab();
      }
    });
  }

  function toggleFab() {
    fabOpen = !fabOpen;
    fab?.classList.toggle('lr-fab--open', fabOpen);
  }

  function closeFab() {
    fabOpen = false;
    fab?.classList.remove('lr-fab--open');
  }

  /* ─── FAB: Note ─────────────────────────────────────────────────── */

  function fabOpenNote() {
    // Extract main page text for AI summarization
    const pageText = extractPageText();

    currentMark = {
      kind: 'page-note',
      label: document.title || location.hostname,
      title: document.title || location.hostname,
      context: pageText,
      sourceUrl: location.href,
      sourceTitle: document.title,
      sourceLocator: null,
    };
    hideBubble();
    openCard(null);
  }

  function extractPageText() {
    // Prefer semantic content containers
    const root = document.querySelector('article, [role="main"], main, .post-content, .article-body')
      || document.body;
    // Walk text nodes, skip scripts/styles/hidden elements
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const el = node.parentElement;
        if (!el) return NodeFilter.FILTER_REJECT;
        const tag = el.tagName?.toLowerCase();
        if (['script', 'style', 'noscript', 'nav', 'footer', 'header'].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const chunks = [];
    let total = 0;
    const MAX = 6000;
    let node;
    while ((node = walker.nextNode()) && total < MAX) {
      const t = node.textContent.trim();
      if (t.length > 20) {
        chunks.push(t);
        total += t.length;
      }
    }
    return chunks.join('\n').slice(0, MAX);
  }

  /* ─── FAB: Screenshot ───────────────────────────────────────────── */

  function fabStartScreenshot() {
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
      startX = e.clientX;
      startY = e.clientY;
      dragging = true;

      selBox = document.createElement('div');
      selBox.className = 'lr-screenshot-selection';
      screenshotOverlay.appendChild(selBox);
    });

    screenshotOverlay.addEventListener('mousemove', (e) => {
      if (!dragging || !selBox) return;
      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);
      selBox.style.left = `${x}px`;
      selBox.style.top = `${y}px`;
      selBox.style.width = `${w}px`;
      selBox.style.height = `${h}px`;
    });

    screenshotOverlay.addEventListener('mouseup', (e) => {
      if (!dragging) return;
      dragging = false;

      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);

      removeScreenshotOverlay();

      if (w < 10 || h < 10) return; // too small, ignore

      // Wait for browser to repaint after removing overlay before capturing
      requestAnimationFrame(() => {
        setTimeout(() => captureAndCrop({ x, y, w, h }), 50);
      });
    });

    const onEsc = (e) => {
      if (e.key === 'Escape') {
        removeScreenshotOverlay();
        document.removeEventListener('keydown', onEsc);
      }
    };
    document.addEventListener('keydown', onEsc);

    document.body.appendChild(screenshotOverlay);
  }

  function removeScreenshotOverlay() {
    if (screenshotOverlay) {
      screenshotOverlay.remove();
      screenshotOverlay = null;
    }
  }

  function captureAndCrop(region) {
    console.log('[LumiNote] captureAndCrop called, region:', region);
    try {
      chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
        console.log('[LumiNote] CAPTURE_SCREENSHOT response:', response ? 'received' : 'empty', 'lastError:', chrome.runtime.lastError?.message || 'none');
        if (chrome.runtime.lastError) {
          console.warn('[LumiNote] Screenshot capture error:', chrome.runtime.lastError.message);
          return;
        }
        if (!response?.ok || !response.dataUrl) {
          console.warn('[LumiNote] Screenshot capture failed:', response?.error || 'no data');
          return;
        }

        console.log('[LumiNote] Got screenshot dataUrl, length:', response.dataUrl.length);
        const img = new Image();
        img.onerror = () => console.warn('[LumiNote] Failed to load screenshot image');
        img.onload = () => {
          console.log('[LumiNote] Image loaded, cropping...');
          // Derive DPR from actual screenshot dimensions rather than window.devicePixelRatio,
          // which can differ on Windows fractional scaling (e.g. 125%, 150%).
          const dpr = img.naturalWidth / window.innerWidth;
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(region.w * dpr);
          canvas.height = Math.round(region.h * dpr);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(
            img,
            Math.round(region.x * dpr), Math.round(region.y * dpr),
            Math.round(region.w * dpr), Math.round(region.h * dpr),
            0, 0,
            Math.round(region.w * dpr), Math.round(region.h * dpr)
          );
          const croppedUrl = canvas.toDataURL('image/png');
          console.log('[LumiNote] Cropped, opening card...');
          openScreenshotCard(croppedUrl);
        };
        img.src = response.dataUrl;
      });
    } catch (err) {
      console.error('[LumiNote] captureAndCrop exception:', err);
    }
  }

  function openScreenshotCard(screenshotDataUrl) {
    currentMark = {
      kind: 'screenshot',
      label: `Screenshot — ${document.title || location.hostname}`,
      title: `Screenshot — ${document.title || location.hostname}`,
      context: '',
      sourceUrl: location.href,
      sourceTitle: document.title,
      imageUrl: screenshotDataUrl,
      imageAlt: 'Screenshot capture',
      sourceLocator: null,
    };

    hideCard();
    currentDepth = 'brief';
    currentMode = 'note';
    loadingDepths.clear();
    aiConfigured = false;

    card = document.createElement('div');
    card.className = 'lumiread-card lumiread-card--screenshot';
    card.setAttribute('data-lumiread', 'true');
    card.innerHTML = buildScreenshotCardHTML(currentMark, screenshotDataUrl);

    // Position handled by CSS (.lumiread-card: fixed, centered)

    document.body.appendChild(card);

    // Lock page scroll, redirect to card content
    enableScrollLock();

    bindCardEvents();
    hydrateAiAvailability();
    card.querySelector('.lr-note-input')?.focus();

    // Screenshot is saved when user clicks Save button (no auto-save)

    setTimeout(() => {
      document.addEventListener('mousedown', onOutsideClick);
    }, 100);
  }

  function buildScreenshotCardHTML(mark, screenshotDataUrl) {
    const sourceLabel = mark.sourceTitle || document.title;
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

      <div class="lr-term">${escapeHtml(truncate(mark.title, 50))}</div>

      <div class="lr-screenshot-preview">
        <img src="${screenshotDataUrl}" alt="Screenshot">
      </div>

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
          <textarea id="lr-note-input" class="lr-note-input" placeholder="Add a note about this screenshot..."></textarea>
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
        <span class="lr-source-label" title="${escapeHtml(document.title)}">
          ${escapeHtml(truncate(sourceLabel, 30))}
        </span>
      </div>
    `;
  }

  /* ─── FAB: Settings ─────────────────────────────────────────────── */

  function fabOpenSettings() {
    const notebookUrl = chrome.runtime.getURL('notebook/notebook.html#settings');
    window.open(notebookUrl, '_blank');
  }

  // Initialize FAB
  if (document.body) {
    createFab();
  } else {
    document.addEventListener('DOMContentLoaded', createFab);
  }
})();
