/**
 * LumiRead — Popup JS
 * Shows learning notebook entries with search/delete.
 */

import { getAllEntries, deleteEntry, searchEntries, getCount, clearAll, formatTimestamp } from '../lib/notebook.js';
import { getEntrySourceMeta } from '../lib/source-meta.js';
import { initLocale, applyI18n } from '../lib/i18n.js';
import { renderMd } from '../lib/render-md.js';

const $ = (id) => document.getElementById(id);

let allEntries = [];

async function init() {
  await initLocale();
  applyI18n();

  await renderEntries();
  await updateStats();
  await initPdfButton();

  $('notebook-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('notebook/notebook.html') });
  });

  $('settings-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('notebook/notebook.html#settings') });
  });

  $('search-input').addEventListener('input', handleSearch);

  $('clear-search').addEventListener('click', () => {
    $('search-input').value = '';
    $('clear-search').style.display = 'none';
    renderEntryList(allEntries);
  });

  $('clear-all-btn').addEventListener('click', async () => {
    if (confirm('Clear all saved terms? This cannot be undone.')) {
      await clearAll();
      allEntries = [];
      renderEntryList([]);
      await updateStats();
    }
  });

  // Listen for new saves while popup is open
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (changes['lumiread_notebook']) {
      await renderEntries();
      await updateStats();
    }
    // Re-apply i18n when display language changes
    if (area === 'sync' && changes['displayLanguage']) {
      await initLocale();
      applyI18n();
    }
  });
}

async function initPdfButton() {
  const pdfBtn = $('pdf-btn');

  // Probe current tab for web PDF
  const context = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_PDF_CONTEXT' }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ canOpen: false });
        return;
      }
      resolve(response || { canOpen: false });
    });
  });

  pdfBtn.addEventListener('click', () => {
    // If current tab has a web PDF, open it directly in viewer
    if (context.canOpen && context.viewerUrl) {
      chrome.tabs.create({ url: context.viewerUrl });
    } else {
      // Otherwise open empty viewer (shows upload prompt)
      chrome.tabs.create({ url: chrome.runtime.getURL('pdf-viewer/pdf-viewer.html') });
    }
  });
}

async function renderEntries() {
  allEntries = await getAllEntries();
  renderEntryList(allEntries);
}

function renderEntryList(entries) {
  const list = $('entry-list');
  const empty = $('empty-state');
  const footer = $('popup-footer');

  // Clear existing cards (keep empty state)
  list.querySelectorAll('.entry-card').forEach((el) => el.remove());

  if (entries.length === 0) {
    empty.style.display = 'flex';
    footer.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  footer.style.display = 'flex';

  entries.forEach((entry) => {
    const card = createEntryCard(entry);
    list.appendChild(card);
  });
}

function createEntryCard(entry) {
  const card = document.createElement('div');
  card.className = 'entry-card';
  card.dataset.id = entry.id;

  const sourceMeta = getEntrySourceMeta(entry);
  const sourceLabel = sourceMeta.pageLabel ? `${sourceMeta.label} · ${sourceMeta.pageLabel}` : sourceMeta.label;
  const bodyText = entry.note || entry.aiSummary || entry.explanation || '';

  card.innerHTML = `
    <div class="entry-card-header">
      <div class="entry-term">${escapeHtml(entry.term)}</div>
      <button class="entry-delete-btn" aria-label="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
    <div class="entry-explanation">${renderMd(bodyText)}</div>
    <div class="entry-meta">
      <a class="entry-source" href="${escapeHtml(sourceMeta.href)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(sourceMeta.title)}">
        ${escapeHtml(sourceLabel)}
      </a>
      <span class="entry-date">${formatTimestamp(entry.timestamp)}</span>
    </div>
  `;

  card.querySelector('.entry-delete-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    await deleteEntry(entry.id);
    card.style.opacity = '0';
    card.style.transform = 'scale(0.96)';
    card.style.transition = 'opacity 150ms ease, transform 150ms ease';
    setTimeout(() => {
      card.remove();
      allEntries = allEntries.filter((en) => en.id !== entry.id);
      if (allEntries.length === 0) {
        $('empty-state').style.display = 'flex';
        $('popup-footer').style.display = 'none';
      }
    }, 150);
    await updateStats();
  });

  return card;
}

async function updateStats() {
  const entries = await getAllEntries();
  $('total-count').textContent = entries.length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = entries.filter((e) => e.timestamp >= todayStart.getTime()).length;
  $('today-count').textContent = todayCount;
}

async function handleSearch(e) {
  const query = e.target.value;
  $('clear-search').style.display = query ? 'flex' : 'none';

  const results = await searchEntries(query);
  renderEntryList(results);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Handle save messages from content script (relayed through background)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'ENTRY_SAVED') {
    renderEntries();
    updateStats();
  }
});

document.addEventListener('DOMContentLoaded', init);
