/**
 * LumiNote — Notebook Full-Page JS
 * Memory Library now supports Today / Calendar / Day subviews.
 */

import { getAllEntries, deleteEntry, searchEntries, clearAll, getTrashEntries, restoreEntry, permanentDeleteEntry, emptyTrash, TRASH_TTL_DAYS } from '../lib/notebook.js';
import { getEntrySourceMeta } from '../lib/source-meta.js';
import { initLocale, applyI18n, t, getLocale } from '../lib/i18n.js';
import { initMoodboard, destroyMoodboard, createNewSession, getActiveSession, getSelectedCardIds, renderSessionList, loadSession, state as mbState } from './moodboard.js';
import { getAllSessions } from '../lib/moodboard.js';
import { getCapability } from '../lib/plan.js';
import { initSync, getCurrentUser, startAutoSync } from '../lib/cloud-sync.js';
import { initAgentChat } from './agent-chat.js';
import { renderMd } from '../lib/render-md.js';
import { processImageFile } from '../lib/image-utils.js';

const $ = (id) => document.getElementById(id);
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let allEntries = [];
let isSearching = false;
let searchQuery = '';
let currentView = 'memory';
let currentMemoryMode = 'today';
let currentDayKey = dateBucket(new Date());
let currentCalendarMonthKey = monthBucket(new Date());
let settingsFrameObserver = null;
let searchRequestId = 0;

async function init() {
  await initLocale();
  applyI18n();
  // Local-only build: nothing to restore, no remote to sync with.
  await initSync();
  if (getCurrentUser()) startAutoSync();

  bindEvents();
  bindHashRouting();
  bindCopyButtons();
  bindImageModal();
  bindCreateNoteDialog();
  bindEditMemoryDialog();
  initSettingsFrame();
  initMcpStatus();

  allEntries = await getAllEntries();

  // Pre-load moodboard sessions so sidebar boards list is visible in memory view
  mbState.sessions = await getAllSessions();
  renderSessionList();

  await applyViewFromHash();
  updateTrashBadge();  // show badge count on nav if trash has items

  // Initialize Agent Chat with live context getter
  initAgentChat(() => {
    const session = getActiveSession();
    const selectedIds = getSelectedCardIds();
    return {
      view: currentView,
      memoryMode: currentMemoryMode,
      searchQuery: isSearching ? searchQuery : '',
      currentDayKey: currentDayKey,
      totalMemories: allEntries.length,
      todayCount: allEntries.filter(e => dateBucket(new Date(e.timestamp)) === dateBucket(new Date())).length,
      selectedCardIds: selectedIds,
      activeSession: session ? {
        id: session.id,
        name: session.name,
        cards: (session.cards || []).map((c) => {
          const entry = allEntries.find((e) => e.id === c.entryId);
          return {
            cardId: c.cardId,
            entryId: c.entryId,
            term: entry?.term || '',
            note: entry?.note || '',
            aiSummary: entry?.aiSummary || '',
            tags: entry?.tags || [],
            sourceUrl: entry?.sourceUrl || '',
            x: c.x,
            y: c.y,
          };
        }),
      } : null,
    };
  });

  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (changes['lumiread_notebook']) {
      allEntries = await getAllEntries();
      await renderCurrentMemoryContent();
      updateStats(allEntries);
    }
    if (changes['lumiread_trash']) {
      updateTrashBadge();
      if (currentView === 'trash') await renderTrashView();
    }
    // Re-apply i18n when display language changes
    if (area === 'sync' && changes['displayLanguage']) {
      await initLocale();
      applyI18n();
      // Re-render current view to update dynamically built t() strings
      await setView(currentView, { syncHash: false });
    }
  });
}

/* ─── Render ─────────────────────────────────────────────────────── */

async function renderCurrentMemoryContent() {
  if (currentView !== 'memory') return;
  $('search-label').style.display = 'none';

  if (isSearching && searchQuery) {
    await renderSearchResults(searchQuery);
    updateMemoryEntryPoints();
    updateStats(allEntries);
    return;
  }

  switch (currentMemoryMode) {
    case 'calendar':
      renderCalendarView(allEntries);
      break;
    case 'day':
      renderDayView(allEntries, currentDayKey);
      break;
    case 'today':
    default:
      renderTodayView(allEntries);
      break;
  }

  updateMemoryEntryPoints();
  updateStats(allEntries);
}

function clearMemorySurface() {
  $('nb-content').innerHTML = '';
  $('empty-state').style.display = 'none';
  $('no-results').style.display = 'none';
}

function showEmptyState(title, hint) {
  clearMemorySurface();
  $('empty-state').querySelector('p').textContent = title;
  $('empty-state').querySelector('.nb-empty-hint').innerHTML = hint;
  $('empty-state').style.display = 'flex';
}

function renderTodayView(entries) {
  clearMemorySurface();

  const todayKey = dateBucket(new Date());
  const items = getEntriesForDate(entries, todayKey);

  // Always render the panel so the title + "新建笔记" button are always visible
  const subtitle = items.length
    ? t('memories_captured_today').replace('{n}', items.length)
    : t('no_marks_saved_today');

  const panel = createMemoryPanel({
    kicker: t('today'),
    title: t('start_from_today'),
    subtitle,
    trailingButton: {
      label: t('create_note'),
      action: () => openCreateNoteDialog(),
    },
  });

  if (items.length) {
    panel.appendChild(createCardsGrid(items));
  } else {
    const hint = document.createElement('p');
    hint.className = 'nb-today-empty-hint';
    hint.innerHTML = !entries.length
      ? t('no_marks_hint')
      : t('no_marks_today_hint');
    panel.appendChild(hint);
  }

  $('nb-content').appendChild(panel);
}

function renderDayView(entries, dayKey) {
  clearMemorySurface();

  const items = getEntriesForDate(entries, dayKey);
  const title = formatDateLong(dayKey);
  const subtitle = items.length
    ? t('memories_saved_on_day').replace('{n}', items.length)
    : t('no_memories_for_date');

  const panel = createMemoryPanel({
    kicker: t('calendar_day'),
    title,
    subtitle,
    backButton: {
      label: t('back_to_calendar'),
      action: () => setMemoryMode('calendar'),
    },
  });

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'nb-memory-inline-empty';
    empty.textContent = t('nothing_saved_on_date');
    panel.appendChild(empty);
  } else {
    panel.appendChild(createCardsGrid(items));
  }

  $('nb-content').appendChild(panel);
}

function renderCalendarView(entries) {
  clearMemorySurface();

  const panel = createMemoryPanel({
    kicker: t('calendar'),
    title: formatMonthTitle(currentCalendarMonthKey),
    subtitle: t('active_days_in_month').replace('{n}', countActiveDaysInMonth(entries, currentCalendarMonthKey)),
    monthNav: true,
  });

  panel.appendChild(createCalendarGrid(entries, currentCalendarMonthKey));
  $('nb-content').appendChild(panel);
}

async function renderSearchResults(query) {
  const requestId = ++searchRequestId;
  clearMemorySurface();

  const results = await searchEntries(query);
  if (requestId !== searchRequestId) return;

  $('search-label').style.display = 'block';
  $('search-label').innerHTML =
    t('search_results_label').replace('{n}', results.length).replace('{q}', escapeHtml(query));

  if (!results.length) {
    $('no-results').style.display = 'flex';
    return;
  }

  const content = $('nb-content');
  for (const group of groupEntriesByExactDate(results)) {
    content.appendChild(createDateGroup(group));
  }
}

function createMemoryPanel({ kicker, title, subtitle, trailingButton = null, backButton = null, monthNav = false }) {
  const panel = document.createElement('section');
  panel.className = 'nb-memory-panel';

  const header = document.createElement('div');
  header.className = 'nb-memory-header';

  const copy = document.createElement('div');
  copy.className = 'nb-memory-copy';
  copy.innerHTML = `
    <div class="nb-memory-kicker">${escapeHtml(kicker)}</div>
    <h2 class="nb-memory-title">${escapeHtml(title)}</h2>
    <p class="nb-memory-subtitle">${escapeHtml(subtitle)}</p>
  `;

  const actions = document.createElement('div');
  actions.className = 'nb-memory-actions';

  if (backButton) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nb-inline-action';
    button.textContent = backButton.label;
    button.addEventListener('click', backButton.action);
    actions.appendChild(button);
  }

  if (trailingButton) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nb-inline-action nb-inline-action--primary';
    button.textContent = trailingButton.label;
    button.addEventListener('click', trailingButton.action);
    actions.appendChild(button);
  }

  if (monthNav) {
    const nav = document.createElement('div');
    nav.className = 'nb-month-nav';
    nav.innerHTML = `
      <button type="button" class="nb-month-nav-btn" aria-label="Previous month">‹</button>
      <button type="button" class="nb-month-nav-btn" aria-label="Next month">›</button>
    `;

    const [prev, next] = nav.querySelectorAll('.nb-month-nav-btn');
    prev.addEventListener('click', () => setMemoryMode('calendar', { monthKey: shiftMonth(currentCalendarMonthKey, -1) }));
    next.addEventListener('click', () => setMemoryMode('calendar', { monthKey: shiftMonth(currentCalendarMonthKey, 1) }));
    actions.appendChild(nav);
  }

  header.appendChild(copy);
  if (actions.childElementCount) {
    header.appendChild(actions);
  }

  panel.appendChild(header);
  return panel;
}

function createCardsGrid(entries) {
  const grid = document.createElement('div');
  grid.className = 'nb-cards';
  for (const entry of sortEntries(entries)) {
    grid.appendChild(createCard(entry));
  }
  return grid;
}

function createCalendarGrid(entries, monthKey) {
  const wrapper = document.createElement('div');
  wrapper.className = 'nb-calendar';

  const weekdayRow = document.createElement('div');
  weekdayRow.className = 'nb-calendar-weekdays';
  for (const label of WEEKDAY_LABELS) {
    const cell = document.createElement('div');
    cell.className = 'nb-calendar-weekday';
    cell.textContent = label;
    weekdayRow.appendChild(cell);
  }
  wrapper.appendChild(weekdayRow);

  const grid = document.createElement('div');
  grid.className = 'nb-calendar-grid';

  const { year, monthIndex, daysInMonth, leadingSlots } = getMonthMeta(monthKey);
  const entriesByDate = buildEntriesByDate(entries);
  const todayKey = dateBucket(new Date());

  for (let i = 0; i < leadingSlots; i += 1) {
    const placeholder = document.createElement('div');
    placeholder.className = 'nb-day-cell nb-day-cell--placeholder';
    grid.appendChild(placeholder);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayKey = `${monthKey}-${String(day).padStart(2, '0')}`;
    const items = entriesByDate.get(dayKey) || [];
    const isToday = dayKey === todayKey;
    const cell = document.createElement(items.length ? 'button' : 'div');
    cell.className = `nb-day-cell${items.length ? ' nb-day-cell--has-entries' : ''}${isToday ? ' nb-day-cell--today' : ''}`;
    if (items.length) {
      cell.type = 'button';
      cell.addEventListener('click', () => setMemoryMode('day', { dayKey }));
    }

    const dateValue = document.createElement('div');
    dateValue.className = 'nb-day-cell__date';
    dateValue.textContent = String(day);
    cell.appendChild(dateValue);

    if (items.length) {
      cell.appendChild(createFolderStackPreview(items));
    } else {
      const quiet = document.createElement('div');
      quiet.className = 'nb-day-cell__quiet';
      quiet.textContent = isToday ? 'Today' : '';
      cell.appendChild(quiet);
    }

    grid.appendChild(cell);
  }

  const trailingSlots = (7 - ((leadingSlots + daysInMonth) % 7)) % 7;
  for (let i = 0; i < trailingSlots; i += 1) {
    const placeholder = document.createElement('div');
    placeholder.className = 'nb-day-cell nb-day-cell--placeholder';
    grid.appendChild(placeholder);
  }

  wrapper.appendChild(grid);

  if (!hasAnyEntriesInMonth(entries, monthKey)) {
    const note = document.createElement('div');
    note.className = 'nb-calendar-empty-note';
    const monthName = new Date(year, monthIndex, 1).toLocaleDateString(getLocale(), { month: 'long' });
    note.textContent = t('no_memories_in_month').replace('{month}', monthName);
    wrapper.appendChild(note);
  }

  return wrapper;
}

function createFolderStackPreview(items) {
  const count = items.length;
  const preview = document.createElement('div');
  preview.className = 'nb-folder-stack';

  const layers = Math.min(Math.max(count, 1), 4);
  for (let index = 0; index < layers; index += 1) {
    const layer = document.createElement('div');
    layer.className = `nb-folder-layer nb-folder-layer--${Math.min(index + 1, 4)}`;
    preview.appendChild(layer);
  }

  const front = document.createElement('div');
  front.className = 'nb-folder-front';
  front.innerHTML = `
    <div class="nb-folder-front__count">${count} ${pluralize(count, 'mark')}</div>
    <div class="nb-folder-front__snippet">${escapeHtml(getEntryPreviewText(items[0]))}</div>
  `;
  preview.appendChild(front);

  return preview;
}

function createDateGroup({ label, count, items }) {
  const groupEl = document.createElement('div');
  groupEl.className = 'nb-date-group';
  groupEl.innerHTML = `
    <div class="nb-date-header">
      <span class="nb-date-label">${escapeHtml(label)}</span>
      <div class="nb-date-divider"></div>
      <span class="nb-date-count">${count} ${pluralize(count, 'result')}</span>
    </div>
  `;

  groupEl.appendChild(createCardsGrid(items));
  return groupEl;
}

function groupEntriesByExactDate(entries) {
  const map = new Map();

  for (const entry of sortEntries(entries)) {
    const ts = getEntryTimestamp(entry);
    if (!ts) continue;
    const key = dateBucket(new Date(ts));
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(entry);
  }

  return [...map.entries()].map(([key, items]) => ({
    label: formatDateLong(key),
    count: items.length,
    items,
  }));
}

/* ─── Entry card ─────────────────────────────────────────────────── */

function createCard(entry) {
  const card = document.createElement('div');
  card.className = 'nb-entry-card';
  card.dataset.id = entry.id;

  const sourceMeta = getEntrySourceMeta(entry);
  const sourceLabel = sourceMeta.pageLabel ? `${sourceMeta.label} · ${sourceMeta.pageLabel}` : sourceMeta.label;
  const bodyText = entry.note || entry.aiSummary || entry.explanation || '';
  const cardTitle = entry.term || (entry.entryType === 'image' ? 'Image mark' : '');
  const thumbnail = entry.entryType === 'image' && entry.imageUrl
    ? `
      <button class="nb-entry-thumbnail" type="button" aria-label="Open image preview">
        <img src="${escapeHtml(entry.imageUrl)}" alt="${escapeHtml(entry.imageAlt || cardTitle || 'Saved image')}">
      </button>
    `
    : '';

  const timeStr = new Date(getEntryTimestamp(entry)).toLocaleTimeString(getLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  });

  card.innerHTML = `
    <div class="nb-entry-card-header">
      <div class="nb-entry-term">${escapeHtml(cardTitle)}</div>
      <button class="nb-entry-delete" aria-label="Delete entry" title="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
    ${thumbnail}
    ${bodyText ? `<div class="nb-entry-explanation">${renderMd(bodyText)}</div>` : ''}
    <div class="nb-entry-meta">
      ${sourceMeta.label
        ? `<a class="nb-entry-source" href="${escapeHtml(sourceMeta.href)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(sourceMeta.title)}">${escapeHtml(sourceLabel)}</a>`
        : '<span></span>'
      }
      <span class="nb-entry-time">${timeStr}</span>
    </div>
  `;

  card.querySelector('.nb-entry-delete').addEventListener('click', (event) => {
    event.stopPropagation();
    void removeCard(card, entry.id);
  });

  card.querySelector('.nb-entry-thumbnail')?.addEventListener('click', (event) => {
    event.stopPropagation();
    openImageModal(entry);
  });

  // Stop source link from triggering card click
  card.querySelector('.nb-entry-source')?.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  card.addEventListener('click', () => {
    openEditMemoryDialog(entry);
  });

  return card;
}

async function removeCard(cardEl, id) {
  cardEl.classList.add('nb-entry-card--removing');
  await deleteEntry(id);
  allEntries = allEntries.filter((entry) => entry.id !== id);
  await renderCurrentMemoryContent();

  // B5: offer undo — entry is tombstoned and lives in Trash for ~15 days.
  showUndoToast(
    t('memory_moved_to_trash') || '已移到回收站',
    async () => {
      await restoreEntry(id);
      allEntries = await getAllEntries();
      await renderCurrentMemoryContent();
    }
  );
}

/**
 * Reusable undo toast. Bottom-centered glass pill, appears for 4s.
 * Calls onUndo() if the user clicks Undo before the timer.
 */
function showUndoToast(message, onUndo, durationMs = 4000) {
  document.querySelectorAll('.nb-undo-toast').forEach((el) => el.remove());

  const toast = document.createElement('div');
  toast.className = 'nb-undo-toast';
  toast.innerHTML = `
    <span class="nb-undo-toast__msg"></span>
    <button class="nb-undo-toast__btn" type="button"></button>
  `;
  toast.querySelector('.nb-undo-toast__msg').textContent = message;
  toast.querySelector('.nb-undo-toast__btn').textContent = t('undo') || 'Undo';
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('nb-undo-toast--in'));

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    toast.classList.remove('nb-undo-toast--in');
    setTimeout(() => toast.remove(), 250);
  };
  const timer = setTimeout(dismiss, durationMs);

  toast.querySelector('.nb-undo-toast__btn').addEventListener('click', () => {
    clearTimeout(timer);
    dismiss();
    try { onUndo?.(); } catch (e) { console.error('[undo] failed', e); }
  });
}

// Expose for other modules (moodboard-card uses it to show the Ctrl+Z hint)
if (typeof window !== 'undefined') {
  window.__luminote_showUndoToast = showUndoToast;
}

/* ─── Trash view ────────────────────────────────────────────────── */

async function renderTrashView() {
  const entries = await getTrashEntries();
  const listEl = $('trash-list');
  const emptyEl = $('trash-empty-state');
  const metaEl  = $('trash-meta');
  const emptyBtn = $('btn-empty-trash');

  listEl.innerHTML = '';

  const now = Date.now();
  const TTL_MS = TRASH_TTL_DAYS * 24 * 60 * 60 * 1000;

  if (entries.length === 0) {
    emptyEl.style.display = '';
    metaEl.textContent = '';
    emptyBtn.style.display = 'none';
  } else {
    emptyEl.style.display = 'none';
    metaEl.textContent = t('trash_meta').replace('{n}', entries.length);
    emptyBtn.style.display = '';
  }

  // Update trash count badge in nav
  const countBadge = $('nav-trash-count');
  if (countBadge) {
    if (entries.length > 0) {
      countBadge.textContent = entries.length;
      countBadge.style.display = '';
    } else {
      countBadge.style.display = 'none';
    }
  }

  for (const entry of entries) {
    const daysLeft = Math.max(1, Math.ceil((TTL_MS - (now - (entry.deletedAt || now))) / (24 * 60 * 60 * 1000)));
    const urgentChip = daysLeft <= 3;
    const card = document.createElement('div');
    card.className = 'nb-entry-card nb-trash-card';

    const sourceMeta = getEntrySourceMeta(entry);
    const bodyText  = entry.note || entry.aiSummary || entry.explanation || '';
    const cardTitle = entry.term || (entry.entryType === 'image' ? 'Image mark' : '');
    const thumbnail = entry.entryType === 'image' && entry.imageUrl
      ? `<div class="nb-entry-thumbnail nb-entry-thumbnail--static"><img src="${escapeHtml(entry.imageUrl)}" alt="${escapeHtml(entry.imageAlt || '')}"></div>`
      : '';

    card.innerHTML = `
      <div class="nb-entry-card-header">
        <div class="nb-entry-term">${escapeHtml(cardTitle)}</div>
        <span class="nb-trash-days-chip ${urgentChip ? 'nb-trash-days-chip--urgent' : ''}">
          ${t('trash_days_left').replace('{n}', daysLeft)}
        </span>
      </div>
      ${thumbnail}
      ${bodyText ? `<div class="nb-entry-explanation">${renderMd(bodyText)}</div>` : ''}
      <div class="nb-entry-meta">
        ${sourceMeta.label
          ? `<span class="nb-entry-source" title="${escapeHtml(sourceMeta.title)}">${escapeHtml(sourceMeta.label)}</span>`
          : '<span></span>'}
        <span class="nb-entry-time">${formatDeletedAt(entry.deletedAt)}</span>
      </div>
      <div class="nb-trash-actions">
        <button class="nb-trash-restore-btn" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          ${t('trash_restore')}
        </button>
        <button class="nb-trash-perma-btn" type="button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          ${t('trash_perma_delete')}
        </button>
      </div>
    `;

    card.querySelector('.nb-trash-restore-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      card.classList.add('nb-entry-card--removing');
      await restoreEntry(entry.id);
      allEntries = await getAllEntries();
      updateStats(allEntries);
      await renderTrashView();
    });

    card.querySelector('.nb-trash-perma-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      card.classList.add('nb-entry-card--removing');
      setTimeout(async () => {
        await permanentDeleteEntry(entry.id);
        await renderTrashView();
      }, 160);
    });

    listEl.appendChild(card);
  }
}

async function updateTrashBadge() {
  try {
    const entries = await getTrashEntries();
    const badge = $('nav-trash-count');
    if (!badge) return;
    if (entries.length > 0) {
      badge.textContent = entries.length;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  } catch (_) {}
}

function formatDeletedAt(ts) {
  if (!ts) return '';
  const dateStr = new Date(ts).toLocaleDateString(getLocale(), {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  return t('trash_deleted_at').replace('{date}', dateStr);
}

/* ─── Stats ─────────────────────────────────────────────────────── */

function updateStats(entries) {
  const todayKey = dateBucket(new Date());
  $('stat-today').textContent = getEntriesForDate(entries, todayKey).length;

  const activeDays = countActiveDaysInMonth(entries, currentCalendarMonthKey);
  $('stat-calendar').textContent = activeDays;
  $('stat-calendar-label').textContent = t('active_days_this_month');
}

function updateMemoryEntryPoints() {
  const isTodayActive = currentView === 'memory' && currentMemoryMode === 'today';
  const isCalendarActive = currentView === 'memory' && (currentMemoryMode === 'calendar' || currentMemoryMode === 'day');

  $('stat-card-today').classList.toggle('nb-stat-card--active', isTodayActive);
  $('stat-card-calendar').classList.toggle('nb-stat-card--active', isCalendarActive);
}

/* ─── Events ─────────────────────────────────────────────────────── */

function bindEvents() {
  $('nav-memory').addEventListener('click', () => {
    void setView('memory');
  });

  $('nav-openclaw').addEventListener('click', () => {
    void setView('openclaw');
  });

  $('nav-settings').addEventListener('click', () => {
    void setView('settings');
  });

  $('mb-new-session-btn').addEventListener('click', async () => {
    // Board count is unlimited in this build; getCapability returns Infinity.
    const limit = await getCapability('maxBoards');
    if (limit !== Infinity) {
      const sessions = await getAllSessions();
      if (sessions.length >= limit) {
        alert(`This build allows up to ${limit} boards.`);
        return;
      }
    }

    const name = prompt('Board name:', 'Untitled Board');
    if (name === null) return;
    if (currentView !== 'moodboard') {
      await setView('moodboard');
    }
    await createNewSession(name || 'Untitled Board');
  });

  $('stat-card-today').addEventListener('click', () => {
    void setMemoryMode('today');
  });

  $('stat-card-calendar').addEventListener('click', () => {
    void setMemoryMode('calendar');
  });

  $('search-input').addEventListener('input', (event) => {
    void handleSearch(event);
  });

  $('clear-search').addEventListener('click', () => {
    resetSearchUi();
  });

  $('nav-trash').addEventListener('click', () => {
    void setView('trash');
  });

  $('btn-empty-trash').addEventListener('click', async () => {
    if (!confirm(t('trash_empty_confirm'))) return;
    await emptyTrash();
    await renderTrashView();
  });

  // Handle board open from sidebar session cards
  window.addEventListener('luminote-open-board', async (e) => {
    const { sessionId } = e.detail || {};
    if (!sessionId) return;
    if (currentView !== 'moodboard') {
      // Switch to moodboard view first, then loadSession will be called after init
      await setView('moodboard');
    }
    await loadSession(sessionId);
  });
}

function bindHashRouting() {
  window.addEventListener('hashchange', () => {
    void applyViewFromHash();
  });
}

async function applyViewFromHash() {
  const hash = window.location.hash.replace('#', '').trim();

  if (hash === 'openclaw') {
    await setView('openclaw', { syncHash: false });
    return;
  }

  if (hash === 'settings') {
    await setView('settings', { syncHash: false });
    return;
  }

  if (hash === 'trash') {
    await setView('trash', { syncHash: false });
    return;
  }

  if (hash === 'moodboard' || hash.startsWith('moodboard/')) {
    await setView('moodboard', { syncHash: false });
    return;
  }

  if (!hash || hash === 'memory' || hash === 'memory/today') {
    await setView('memory', { syncHash: false, memoryMode: 'today' });
    return;
  }

  if (hash.startsWith('memory/calendar')) {
    const monthKey = hash.split('/')[2];
    await setView('memory', {
      syncHash: false,
      memoryMode: 'calendar',
      memoryMonthKey: isMonthKey(monthKey) ? monthKey : currentCalendarMonthKey,
    });
    return;
  }

  if (hash.startsWith('memory/day/')) {
    const dayKey = hash.split('/')[2];
    await setView('memory', {
      syncHash: false,
      memoryMode: 'day',
      memoryDayKey: isDayKey(dayKey) ? dayKey : currentDayKey,
      memoryMonthKey: isDayKey(dayKey) ? dayKey.slice(0, 7) : currentCalendarMonthKey,
    });
    return;
  }

  await setView('memory', { syncHash: false, memoryMode: 'today' });
}

async function setView(view, options = {}) {
  const {
    syncHash = true,
    memoryMode = currentMemoryMode,
    memoryDayKey = currentDayKey,
    memoryMonthKey = currentCalendarMonthKey,
  } = options;

  const validViews = ['memory', 'openclaw', 'settings', 'moodboard', 'trash'];
  currentView = validViews.includes(view) ? view : 'memory';

  if (currentView === 'memory') {
    currentMemoryMode = memoryMode;
    currentDayKey = memoryDayKey;
    currentCalendarMonthKey = memoryMonthKey;
  }

  // Memory nav stays active for both memory and moodboard (unified experience)
  const isMemoryOrBoard = currentView === 'memory' || currentView === 'moodboard';
  $('nav-memory').classList.toggle('nb-nav-item--active', isMemoryOrBoard);
  $('nav-openclaw').classList.toggle('nb-nav-item--active', currentView === 'openclaw');
  $('nav-settings').classList.toggle('nb-nav-item--active', currentView === 'settings');
  $('nav-trash').classList.toggle('nb-nav-item--active', currentView === 'trash');
  $('nav-memory').setAttribute('aria-current', isMemoryOrBoard ? 'page' : 'false');
  $('nav-openclaw').setAttribute('aria-current', currentView === 'openclaw' ? 'page' : 'false');
  $('nav-settings').setAttribute('aria-current', currentView === 'settings' ? 'page' : 'false');
  $('nav-trash').setAttribute('aria-current', currentView === 'trash' ? 'page' : 'false');

  // Toggle full-bleed layout class for moodboard
  document.querySelector('.nb-layout').classList.toggle('nb-view--moodboard', currentView === 'moodboard');

  $('memory-view').style.display = currentView === 'memory' ? '' : 'none';
  $('moodboard-view').style.display = currentView === 'moodboard' ? '' : 'none';
  $('openclaw-view').style.display = currentView === 'openclaw' ? '' : 'none';
  $('settings-view').style.display = currentView === 'settings' ? '' : 'none';
  $('trash-view').style.display = currentView === 'trash' ? '' : 'none';
  $('nb-search-wrapper').style.display = currentView === 'memory' ? 'flex' : 'none';

  // Toggle sidebar: stats + inline boards visible for memory AND moodboard
  const stats = $('stat-card-today').closest('.nb-stats');
  if (currentView === 'moodboard' || currentView === 'memory') {
    stats.style.display = '';
    stats.style.opacity = '1';
  } else {
    // openclaw / settings / trash — hide stats + boards
    stats.style.display = 'none';
  }

  const pageTitle = $('nb-page-title');
  pageTitle.textContent = (currentView === 'memory' || currentView === 'moodboard')
    ? t('my_memory_library')
    : currentView === 'openclaw'
      ? t('openclaw')
      : currentView === 'trash'
        ? t('trash')
        : t('settings');

  // Lifecycle: init/destroy moodboard
  if (currentView === 'moodboard') {
    await initMoodboard();
  } else {
    destroyMoodboard();
  }

  if (currentView === 'trash') {
    await renderTrashView();
  } else if (currentView !== 'memory') {
    resetSearchUi({ rerender: false });
  } else {
    await renderCurrentMemoryContent();
  }

  if (syncHash) {
    syncHashForCurrentState();
  }
}

function syncHashForCurrentState() {
  let nextHash = '#memory/today';

  if (currentView === 'moodboard') {
    nextHash = '#moodboard';
  } else if (currentView === 'openclaw') {
    nextHash = '#openclaw';
  } else if (currentView === 'settings') {
    nextHash = '#settings';
  } else if (currentView === 'trash') {
    nextHash = '#trash';
  } else if (currentMemoryMode === 'calendar') {
    nextHash = `#memory/calendar/${currentCalendarMonthKey}`;
  } else if (currentMemoryMode === 'day') {
    nextHash = `#memory/day/${currentDayKey}`;
  }

  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  }
}

async function setMemoryMode(mode, { dayKey = currentDayKey, monthKey = currentCalendarMonthKey } = {}) {
  const nextMonthKey = mode === 'day' ? dayKey.slice(0, 7) : monthKey;
  await setView('memory', {
    memoryMode: mode,
    memoryDayKey: dayKey,
    memoryMonthKey: nextMonthKey,
  });
}

function initSettingsFrame() {
  const frame = $('settings-frame');
  if (!frame) return;

  frame.addEventListener('load', () => {
    syncSettingsFrameHeight();

    try {
      settingsFrameObserver?.disconnect();

      const frameWindow = frame.contentWindow;
      const resizeTarget =
        frame.contentDocument?.documentElement ||
        frame.contentDocument?.body ||
        null;

      if (resizeTarget && 'ResizeObserver' in window) {
        settingsFrameObserver = new ResizeObserver(() => {
          syncSettingsFrameHeight();
        });
        settingsFrameObserver.observe(resizeTarget);
      }

      frameWindow?.addEventListener('resize', syncSettingsFrameHeight);
      frameWindow?.requestAnimationFrame?.(() => syncSettingsFrameHeight());
    } catch {
      // Same-origin access is expected here; ignore if unavailable.
    }
  });

  frame.src = chrome.runtime.getURL('options/options.html?embedded=1');
}

function syncSettingsFrameHeight() {
  const frame = $('settings-frame');
  if (!frame) return;

  try {
    const doc = frame.contentDocument;
    if (!doc) return;

    const nextHeight = Math.max(
      doc.documentElement?.scrollHeight || 0,
      doc.body?.scrollHeight || 0,
      720
    );

    frame.style.height = `${nextHeight}px`;
  } catch {
    // Ignore resize failures and keep the fallback min-height.
  }
}

function resetSearchUi(options = {}) {
  const { rerender = true } = options;
  $('search-input').value = '';
  $('clear-search').style.display = 'none';
  $('search-label').style.display = 'none';
  isSearching = false;
  searchQuery = '';
  searchRequestId += 1;

  if (rerender && currentView === 'memory') {
    void renderCurrentMemoryContent();
  }
}

function bindCopyButtons() {
  const copyAllBtn = document.getElementById('oc-copy-all-btn');
  if (copyAllBtn) {
    copyAllBtn.addEventListener('click', async () => {
      const payload = buildMcpSetupPrompt();
      await copyText(payload);

      const original = copyAllBtn.innerHTML;
      copyAllBtn.textContent = `✓ ${t('copied')}`;
      copyAllBtn.disabled = true;
      setTimeout(() => {
        copyAllBtn.innerHTML = original;
        copyAllBtn.disabled = false;
      }, 2000);
    });
  }

  document.querySelectorAll('.oc-copy-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetId = button.dataset.copyTarget;
      const target = targetId ? document.getElementById(targetId) : null;
      if (!target) return;

      await copyText(target.textContent || '');

      const original = button.textContent;
      button.textContent = 'Copied';
      button.disabled = true;
      setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
      }, 1400);
    });
  });
}

function bindImageModal() {
  $('image-modal-close')?.addEventListener('click', closeImageModal);
  $('image-modal')?.addEventListener('click', (event) => {
    if (event.target?.dataset?.closeImageModal === 'true') {
      closeImageModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('image-modal')?.hidden) {
      closeImageModal();
    }
  });
}

function openImageModal(entry) {
  if (!entry?.imageUrl) return;

  $('image-modal-img').src = entry.imageUrl;
  $('image-modal-img').alt = entry.imageAlt || entry.term || 'Saved image';
  $('image-modal-title').textContent = entry.term || entry.imageAlt || 'Saved image';
  $('image-modal-link').href = entry.sourceUrl || entry.imageUrl;
  $('image-modal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeImageModal() {
  $('image-modal').hidden = true;
  $('image-modal-img').removeAttribute('src');
  document.body.style.overflow = '';
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', 'true');
  input.style.position = 'absolute';
  input.style.left = '-9999px';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}

async function handleSearch(event) {
  searchQuery = event.target.value.trim();
  $('clear-search').style.display = searchQuery ? 'flex' : 'none';
  isSearching = !!searchQuery;

  if (!searchQuery) {
    $('search-label').style.display = 'none';
    await renderCurrentMemoryContent();
    return;
  }

  await renderCurrentMemoryContent();
}

/* ─── Data helpers ───────────────────────────────────────────────── */

function sortEntries(entries) {
  return [...entries].sort((a, b) => getEntryTimestamp(b) - getEntryTimestamp(a));
}

function getEntriesForDate(entries, dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const start = new Date(year, month - 1, day).getTime();
  const end = new Date(year, month - 1, day + 1).getTime();
  return sortEntries(
    entries.filter((entry) => {
      const ts = getEntryTimestamp(entry);
      return ts >= start && ts < end;
    })
  );
}

function buildEntriesByDate(entries) {
  const map = new Map();

  for (const entry of sortEntries(entries)) {
    const ts = getEntryTimestamp(entry);
    if (!ts) continue;
    const key = dateBucket(new Date(ts));
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(entry);
  }

  return map;
}

function countActiveDaysInMonth(entries, monthKey) {
  const set = new Set();
  for (const entry of entries) {
    const ts = getEntryTimestamp(entry);
    if (!ts) continue;
    const key = dateBucket(new Date(ts));
    if (key.startsWith(`${monthKey}-`)) {
      set.add(key);
    }
  }
  return set.size;
}

function hasAnyEntriesInMonth(entries, monthKey) {
  return entries.some((entry) => {
    const ts = getEntryTimestamp(entry);
    if (!ts) return false;
    return dateBucket(new Date(ts)).startsWith(`${monthKey}-`);
  });
}

function getEntryPreviewText(entry) {
  return entry.note || entry.aiSummary || entry.explanation || entry.term || 'Open this day';
}

function getMonthMeta(monthKey) {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingSlots = firstDay.getDay();

  return {
    year,
    monthIndex,
    daysInMonth,
    leadingSlots,
  };
}

function shiftMonth(monthKey, delta) {
  const { year, monthIndex } = parseMonthKey(monthKey);
  const next = new Date(year, monthIndex + delta, 1);
  return monthBucket(next);
}

function getEntryTimestamp(entry) {
  const raw = entry?.timestamp;
  const ts = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(ts) ? ts : 0;
}

/* ─── Date helpers ───────────────────────────────────────────────── */

function dateBucket(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthBucket(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function parseMonthKey(monthKey) {
  const [year, month] = String(monthKey).split('-').map(Number);
  return {
    year,
    monthIndex: month - 1,
  };
}

function isDayKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '');
}

function isMonthKey(value) {
  return /^\d{4}-\d{2}$/.test(value || '');
}

function formatMonthTitle(monthKey) {
  const { year, monthIndex } = parseMonthKey(monthKey);
  return new Date(year, monthIndex, 1).toLocaleDateString(getLocale(), {
    month: 'long',
    year: 'numeric',
  });
}

function formatDateLong(dateKey) {
  return parseDateKey(dateKey).toLocaleDateString(getLocale(), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function pluralize(count, singular) {
  if (count === 1) return singular;
  if (singular === 'memory') return 'memories';
  return `${singular}s`;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─── OpenClaw context builder ──────────────────────────────────── */

function buildMcpSetupPrompt() {
  return `# LumiNote MCP Server — Setup & API Reference

You are helping the user connect an AI agent to the LumiNote Chrome extension via MCP (Model Context Protocol). Follow these steps to install and configure the MCP server.

## Step 1: Install the MCP server

Run:
npm install -g luminote-mcp-server

## Step 2: Add to your AI agent's MCP config

Add the following to your MCP configuration file (e.g. claude_desktop_config.json, .cursor/mcp.json, etc.):

{
  "mcpServers": {
    "luminote": {
      "command": "npx",
      "args": ["-y", "luminote-mcp-server"]
    }
  }
}

## Step 3: Keep the LumiNote notebook page open

The MCP server communicates with LumiNote through a local WebSocket bridge. The LumiNote notebook page (chrome-extension://...) must be open in Chrome for the bridge to stay alive.

---

## API Reference

All operations use chrome.runtime.sendMessage(). Each message has a "type" field and returns a response with { ok: true/false }.

### Write APIs

#### CREATE_MEMORY
Create a new Memory Block. "id" and "timestamp" are auto-generated.

chrome.runtime.sendMessage({
  type: "CREATE_MEMORY",
  block: {
    "term": "Attention Is All You Need",
    "entryType": "text",
    "sourceKind": "web",
    "sourceUrl": "https://arxiv.org/abs/1706.03762",
    "sourceTitle": "Attention Is All You Need — arXiv",
    "note": "Foundational transformer paper.",
    "aiSummary": "Introduces the Transformer model.",
    "context": "We propose a new simple network architecture...",
    "tags": ["transformers", "attention"]
  }
}, response => console.log(response))
// → { ok: true, id: "lr_1744027620000_abc1234" }

#### UPDATE_MEMORY
Patch mutable fields: term, note, aiSummary, tags.

chrome.runtime.sendMessage({
  type: "UPDATE_MEMORY",
  id: "lr_1234567890_abc1234",
  fields: {
    "note": "Revised: also relevant for vision transformers (ViT).",
    "tags": ["transformers", "attention", "deep-learning"]
  }
}, response => console.log(response))
// → { ok: true }

#### DELETE_MEMORY
Permanently remove a Memory Block.

chrome.runtime.sendMessage({
  type: "DELETE_MEMORY",
  id: "lr_1234567890_abc1234"
}, response => console.log(response))
// → { ok: true }

### Read APIs

#### SEARCH_MEMORIES
Search by term, note, aiSummary, context. Filter by sourceKind, entryType, domain, date range.

chrome.runtime.sendMessage({
  type: "SEARCH_MEMORIES",
  query: "transformer",
  filters: { sourceKind: "web", limit: 10 }
}, response => console.log(response))
// → { ok: true, results: [...], total: 3 }

#### GET_MEMORY
Retrieve the full Memory Block.

chrome.runtime.sendMessage({
  type: "GET_MEMORY",
  id: "lr_1234567890_abc1234"
}, response => console.log(response))
// → { ok: true, memory: { id, term, note, ... } }

#### OPEN_MEMORY
Reopen the saved page/PDF in a new tab.

chrome.runtime.sendMessage({
  type: "OPEN_MEMORY",
  id: "lr_1234567890_abc1234"
}, response => console.log(response))
// → { ok: true, sourceUrl, sourceTitle, ... }

### Moodboard APIs

#### LIST_MOODBOARD_SESSIONS
chrome.runtime.sendMessage({ type: "LIST_MOODBOARD_SESSIONS" }, r => console.log(r))
// → { ok: true, sessions: [{ id, name, createdAt, updatedAt, cardCount }] }

#### GET_MOODBOARD_SESSION
chrome.runtime.sendMessage({ type: "GET_MOODBOARD_SESSION", id: "mb_..." }, r => console.log(r))
// → { ok: true, session: { id, name, viewport, cards: [{ cardId, entryId, x, y, entry }] } }

#### CREATE_MOODBOARD_SESSION
chrome.runtime.sendMessage({ type: "CREATE_MOODBOARD_SESSION", name: "Research" }, r => console.log(r))
// → { ok: true, session: { id, name, cards: [] } }

#### UPDATE_MOODBOARD_SESSION
chrome.runtime.sendMessage({ type: "UPDATE_MOODBOARD_SESSION", id: "mb_...", fields: { name: "New Name" } }, r => console.log(r))
// → { ok: true }

#### DELETE_MOODBOARD_SESSION
chrome.runtime.sendMessage({ type: "DELETE_MOODBOARD_SESSION", id: "mb_..." }, r => console.log(r))
// → { ok: true }

#### ADD_MOODBOARD_CARD
chrome.runtime.sendMessage({ type: "ADD_MOODBOARD_CARD", sessionId: "mb_...", entryId: "lr_...", x: 200, y: 150 }, r => console.log(r))
// → { ok: true, card: { cardId, entryId, x, y } }

#### REMOVE_MOODBOARD_CARD
chrome.runtime.sendMessage({ type: "REMOVE_MOODBOARD_CARD", sessionId: "mb_...", cardId: "mbc_..." }, r => console.log(r))
// → { ok: true }

---

## Memory Block Schema

{
  "id": "lr_<timestamp>_<random>",
  "term": "string — the marked word/phrase/image title",
  "entryType": "text | image",
  "sourceKind": "web | pdf | manual",
  "sourceUrl": "string — origin page URL",
  "sourceTitle": "string",
  "context": "string — surrounding paragraph at mark time",
  "note": "string — human-written note",
  "aiSummary": "string — AI-generated summary (may be empty)",
  "timestamp": "number — Unix ms",
  "tags": "string[]",
  "sourceAnchor": { "quote": "string", "prefix": "string", "suffix": "string" },
  "sourceLocator": "object | null — DOM/PDF offset for re-location",
  "sourcePage": "number | null — PDF page number",
  "imageUrl": "string | null — image entry only",
  "imageAlt": "string | null"
}`;
}

/* ─── Create Note dialog ─────────────────────────────────────────── */

let creatingImageUrl = '';

export function openCreateNoteDialog() {
  const dialog = document.getElementById('create-note-dialog');
  if (!dialog) return;

  document.getElementById('cn-title').value = '';
  document.getElementById('cn-note').value = '';
  creatingImageUrl = '';
  updateCreateImageSlotUI();

  document.getElementById('cn-save').disabled = false;
  document.getElementById('cn-save').textContent = '';
  document.getElementById('cn-save').innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
    Save
  `;

  dialog.showModal();
  requestAnimationFrame(() => {
    document.getElementById('cn-title').focus();
  });
}

function updateCreateImageSlotUI() {
  const filled = document.getElementById('cn-image-filled');
  const empty = document.getElementById('cn-image-empty');
  const img = document.getElementById('cn-image');
  if (!filled || !empty || !img) return;

  if (creatingImageUrl) {
    img.src = creatingImageUrl;
    filled.style.display = '';
    empty.style.display = 'none';
  } else {
    img.src = '';
    filled.style.display = 'none';
    empty.style.display = '';
  }
}

function bindCreateNoteDialog() {
  const dialog = document.getElementById('create-note-dialog');
  if (!dialog) return;

  document.getElementById('cn-close').addEventListener('click', () => {
    dialog.close();
  });

  dialog.addEventListener('click', (e) => {
    // Close on backdrop click
    if (e.target === dialog) dialog.close();
  });

  document.getElementById('cn-save').addEventListener('click', async () => {
    const term = document.getElementById('cn-title').value.trim();
    const note = document.getElementById('cn-note').value.trim();
    if (!note && !term && !creatingImageUrl) return;

    const btn = document.getElementById('cn-save');
    btn.disabled = true;
    btn.innerHTML = 'Saving…';

    const entryData = {
      term: term || 'Quick Note',
      note,
      context: '',
      sourceUrl: '',
      sourceTitle: 'Manual note',
    };
    if (creatingImageUrl) {
      entryData.imageUrl = creatingImageUrl;
      entryData.entryType = 'image';
    }

    const { saveEntry } = await import('../lib/notebook.js');
    const newId = await saveEntry(entryData);

    // If we're in moodboard view with an active session, add the new card
    if (currentView === 'moodboard' && newId) {
      const { addCardById } = await import('./moodboard.js');
      await addCardById(newId);
    }

    btn.innerHTML = 'Saved!';
    setTimeout(() => dialog.close(), 600);
  });

  // Image slot handlers
  const cnFileInput = document.getElementById('cn-image-file');
  document.getElementById('cn-image-empty').addEventListener('click', () => {
    cnFileInput.click();
  });
  document.getElementById('cn-image-replace').addEventListener('click', () => {
    cnFileInput.click();
  });
  document.getElementById('cn-image-remove').addEventListener('click', () => {
    creatingImageUrl = '';
    updateCreateImageSlotUI();
  });
  cnFileInput.addEventListener('change', async () => {
    const file = cnFileInput.files?.[0];
    if (!file) return;
    creatingImageUrl = await processImageFile(file);
    updateCreateImageSlotUI();
    cnFileInput.value = '';
  });

  // Cmd/Ctrl+Enter to save
  dialog.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      document.getElementById('cn-save').click();
    }
  });

}

/* ─── Edit Memory dialog ─────────────────────────────────────────── */

let editingEntryId = null;
let editingImageUrl = '';

export function openEditMemoryDialog(entry) {
  const dialog = document.getElementById('edit-memory-dialog');
  if (!dialog) return;

  editingEntryId = entry.id;

  document.getElementById('em-title').value = entry.term || '';

  // Merge note: show user note, or fall back to AI summary / context
  const noteContent = entry.note || entry.aiSummary || entry.explanation || entry.context || '';
  document.getElementById('em-note').value = noteContent;

  // Image slot — always visible
  editingImageUrl = entry.imageUrl || '';
  updateImageSlotUI();

  // Hide the old context section (merged into note)
  const contextSection = document.getElementById('em-context-section');
  if (contextSection) contextSection.style.display = 'none';

  // Show source link — use getEntrySourceMeta so PDF entries open in the PDF viewer
  const sourceRow = document.getElementById('em-source-row');
  const sourceLink = document.getElementById('em-source-link');
  if (entry.sourceUrl) {
    const sm = getEntrySourceMeta(entry);
    sourceLink.href = sm.href;         // PDF entries → viewer URL; web → raw URL
    sourceLink.textContent = sm.title || entry.sourceUrl;
    sourceRow.style.display = 'flex';
  } else {
    sourceRow.style.display = 'none';
  }

  // Reset save button
  const btn = document.getElementById('em-save');
  btn.disabled = false;
  btn.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
    <span>${t('save_changes')}</span>
  `;
  document.getElementById('em-status').textContent = '';

  // B3: compute initial Polish-button state based on loaded content
  refreshPolishButtonState();

  dialog.showModal();
  requestAnimationFrame(() => {
    document.getElementById('em-title').focus();
  });
}

/** Disable "AI Polish" button when both note and title are empty (bug B3).
    Called on modal open and on every input change. */
function refreshPolishButtonState() {
  const polishBtn = document.getElementById('em-ai-polish');
  const noteEl = document.getElementById('em-note');
  const titleEl = document.getElementById('em-title');
  if (!polishBtn || !noteEl || !titleEl) return;
  const hasText = (noteEl.value.trim() !== '') || (titleEl.value.trim() !== '');
  polishBtn.disabled = !hasText;
  polishBtn.title = hasText ? '' : (t('polish_empty_hint') || 'Type something first');
}

function bindEditMemoryDialog() {
  const dialog = document.getElementById('edit-memory-dialog');
  if (!dialog) return;

  document.getElementById('em-close').addEventListener('click', () => {
    dialog.close();
  });

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  // B3: keep Polish button in sync with actual content
  document.getElementById('em-note')?.addEventListener('input', refreshPolishButtonState);
  document.getElementById('em-title')?.addEventListener('input', refreshPolishButtonState);

  document.getElementById('em-save').addEventListener('click', async () => {
    if (!editingEntryId) return;

    const btn = document.getElementById('em-save');
    btn.disabled = true;
    btn.innerHTML = t('saving');

    const { updateEntry } = await import('../lib/notebook.js');
    const fields = {
      term: document.getElementById('em-title').value.trim(),
      note: document.getElementById('em-note').value.trim(),
      imageUrl: editingImageUrl,
    };
    // Update entryType if image was added/removed
    if (editingImageUrl) {
      fields.entryType = 'image';
    }
    await updateEntry(editingEntryId, fields);

    // Refresh data
    allEntries = await getAllEntries();
    await renderCurrentMemoryContent();
    updateStats(allEntries);

    btn.textContent = t('changes_saved');

    setTimeout(() => dialog.close(), 600);
  });

  // Cmd/Ctrl+Enter to save
  dialog.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      document.getElementById('em-save').click();
    }
  });

  // Image slot: add image
  const fileInput = document.getElementById('em-image-file');
  document.getElementById('em-image-empty').addEventListener('click', () => {
    fileInput.click();
  });

  // Image slot: replace image
  document.getElementById('em-image-replace').addEventListener('click', () => {
    fileInput.click();
  });

  // Image slot: remove image
  document.getElementById('em-image-remove').addEventListener('click', () => {
    editingImageUrl = '';
    updateImageSlotUI();
  });

  // File input change → read as data URL (5 MB limit + auto-compress)
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    editingImageUrl = await processImageFile(file);
    updateImageSlotUI();
    fileInput.value = ''; // reset so same file can be re-selected
  });

  // AI Polish Text button
  document.getElementById('em-ai-polish').addEventListener('click', async () => {
    const btn = document.getElementById('em-ai-polish');
    const noteEl = document.getElementById('em-note');
    const titleEl = document.getElementById('em-title');
    const noteText = noteEl.value.trim();
    const titleText = titleEl.value.trim();
    if (!noteText && !titleText) return;

    btn.disabled = true;
    const origHTML = btn.innerHTML;
    btn.innerHTML = `<span>${t('ai_polishing')}</span>`;

    try {
      const { streamExplain, loadConfig } = await import('../lib/api-providers.js');
      const config = await loadConfig();
      const lang = config.outputLanguage || 'Chinese';

      let result = '';
      await streamExplain({
        messages: [
          { role: 'system', content: `You are a writing assistant. Respond in ${lang}. Polish and refine the following text. Fix grammar, improve clarity and flow. Keep the original meaning. Return ONLY the polished text, no explanations.` },
          { role: 'user', content: noteText || titleText },
        ],
        maxTokens: 1024,
        onChunk: (text) => { result += text; noteEl.value = result; },
        onDone: () => { btn.disabled = false; btn.innerHTML = origHTML; },
        onError: (err) => { btn.disabled = false; btn.innerHTML = origHTML; document.getElementById('em-status').textContent = err; },
      });
    } catch (e) {
      btn.disabled = false; btn.innerHTML = origHTML;
      document.getElementById('em-status').textContent = e.message;
    }
  });

  // AI Image Understanding button
  document.getElementById('em-ai-vision').addEventListener('click', async () => {
    const btn = document.getElementById('em-ai-vision');
    const noteEl = document.getElementById('em-note');
    if (!editingImageUrl) return;

    btn.disabled = true;
    const origHTML = btn.innerHTML;
    btn.innerHTML = `<span>${t('ai_summarizing')}</span>`;

    try {
      const { streamExplain, loadConfig } = await import('../lib/api-providers.js');
      const config = await loadConfig();
      const lang = config.outputLanguage || 'Chinese';

      const userContent = [];
      const dataUrlMatch = editingImageUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (dataUrlMatch) {
        // Local base64 image
        userContent.push({ type: 'image', mimeType: dataUrlMatch[1], data: dataUrlMatch[2] });
      } else if (editingImageUrl.startsWith('http')) {
        // Remote image (R2 etc.) — fetch and convert to base64
        try {
          const resp = await fetch(editingImageUrl);
          const blob = await resp.blob();
          const mime = blob.type || 'image/jpeg';
          const b64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          userContent.push({ type: 'image', mimeType: mime, data: b64 });
        } catch (fetchErr) {
          console.warn('[Vision] Failed to fetch remote image:', fetchErr);
          document.getElementById('em-status').textContent = 'Failed to load image for analysis';
          btn.disabled = false; btn.innerHTML = origHTML;
          return;
        }
      }
      const noteText = noteEl.value.trim();
      userContent.push({ type: 'text', text: noteText ? `Existing note: ${noteText}\n\nPlease analyze this image and enrich the note.` : 'Describe and summarize this image.' });

      let result = '';
      await streamExplain({
        messages: [
          { role: 'system', content: `You are a helpful assistant. Respond in ${lang}. Analyze the image and provide a concise summary in 1-3 sentences.` },
          { role: 'user', content: userContent },
        ],
        maxTokens: 1024,
        onChunk: (text) => { result += text; noteEl.value = result; },
        onDone: () => { btn.disabled = false; btn.innerHTML = origHTML; },
        onError: (err) => { btn.disabled = false; btn.innerHTML = origHTML; document.getElementById('em-status').textContent = err; },
      });
    } catch (e) {
      btn.disabled = false; btn.innerHTML = origHTML;
      document.getElementById('em-status').textContent = e.message;
    }
  });

}

function updateImageSlotUI() {
  const filled = document.getElementById('em-image-filled');
  const empty = document.getElementById('em-image-empty');
  const img = document.getElementById('em-image');
  const visionBtn = document.getElementById('em-ai-vision');
  if (!filled || !empty || !img) return;

  if (editingImageUrl) {
    img.src = editingImageUrl;
    filled.style.display = '';
    empty.style.display = 'none';
    if (visionBtn) visionBtn.style.display = '';
  } else {
    img.src = '';
    filled.style.display = 'none';
    empty.style.display = '';
    if (visionBtn) visionBtn.style.display = 'none';
  }
}

/* ─── MCP WebSocket Bridge (persistent, runs in notebook page) ── */

let mcpWs = null;
let mcpReconnectTimer = null;
const MCP_WS_URL = 'ws://127.0.0.1:19960';

function initMcpStatus() {
  mcpBridgeConnect();
}

function updateMcpStatusUI(connected) {
  const dot = document.getElementById('oc-mcp-dot');
  const text = document.getElementById('oc-mcp-status-text');
  if (!dot || !text) return;
  if (connected) {
    dot.className = 'oc-status-dot connected';
    text.textContent = t('oc_mcp_connected');
  } else {
    dot.className = 'oc-status-dot disconnected';
    text.textContent = t('oc_mcp_disconnected');
  }
}

function mcpBridgeConnect() {
  if (mcpWs && mcpWs.readyState <= 1) return;

  try {
    mcpWs = new WebSocket(MCP_WS_URL);
  } catch {
    updateMcpStatusUI(false);
    scheduleMcpReconnect();
    return;
  }

  mcpWs.onopen = () => {
    console.log('[luminote-bridge] Connected to MCP server');
    updateMcpStatusUI(true);
    if (mcpReconnectTimer) {
      clearInterval(mcpReconnectTimer);
      mcpReconnectTimer = null;
    }
  };

  mcpWs.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      const { _reqId, type, ...rest } = msg;
      if (!type || _reqId == null) return;

      // Forward to service worker via chrome.runtime.sendMessage
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type, ...rest }, (resp) => {
          resolve(resp);
        });
      });

      mcpWs.send(JSON.stringify({ _reqId, response }));
    } catch (e) {
      console.error('[luminote-bridge] Error:', e);
    }
  };

  mcpWs.onclose = () => {
    console.log('[luminote-bridge] Disconnected');
    mcpWs = null;
    updateMcpStatusUI(false);
    scheduleMcpReconnect();
  };

  mcpWs.onerror = () => {
    mcpWs = null;
    updateMcpStatusUI(false);
    scheduleMcpReconnect();
  };
}

function scheduleMcpReconnect() {
  if (mcpReconnectTimer) return;
  mcpReconnectTimer = setInterval(() => mcpBridgeConnect(), 5000);
}

document.addEventListener('DOMContentLoaded', () => {
  void init();
});
