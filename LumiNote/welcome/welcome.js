/**
 * welcome.js — First-install onboarding controller.
 *
 * Reads i18n, drives chapter navigation (scroll-snap deck), lazily renders
 * each chapter's simulated UI mock on first entry (IntersectionObserver), and
 * persists completion state under chrome.storage.local.luminote_onboarding.
 *
 * Chapter UIs reuse real LumiNote CSS classes (content.css for Explain card,
 * agent-chat.css for chat bubbles) so the demo looks bit-perfect to the
 * product. No real AI calls, no login — every result is pre-baked mock data.
 */

import { initLocale, applyI18n, t, getLocale } from '../lib/i18n.js';
import { MOCK } from './mock-data.js';
import { renderMd } from '../lib/render-md.js';

const ONBOARDING_VERSION = 1;
const ONBOARDING_KEY = 'luminote_onboarding';
const TOTAL_CHAPTERS = 6;      // 5 content chapters + 1 final CTA
const FINAL_CHAPTER_INDEX = 5;

/* ─── Persistence ──────────────────────────────────────────────── */

function loadState() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [ONBOARDING_KEY]: {} }, (r) => resolve(r[ONBOARDING_KEY] || {}));
  });
}

async function saveState(patch) {
  const prev = await loadState();
  return new Promise((resolve) => {
    chrome.storage.local.set({
      [ONBOARDING_KEY]: { ...prev, ...patch, version: ONBOARDING_VERSION },
    }, resolve);
  });
}

async function markComplete({ skipped, lastChapter }) {
  await saveState({ completedAt: Date.now(), skipped, lastChapter });
}

/* ─── Navigation ───────────────────────────────────────────────── */

let currentIndex = 0;
const deck = document.getElementById('welcome-deck');
const dots = Array.from(document.querySelectorAll('.welcome-dot'));

function goToChapter(idx) {
  idx = Math.max(0, Math.min(TOTAL_CHAPTERS - 1, idx));
  currentIndex = idx;
  const target = deck.children[idx];
  if (target) target.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  syncChromeToIndex(idx);
}

function syncChromeToIndex(idx) {
  dots.forEach((d) => d.classList.toggle('is-active', +d.dataset.chapter === idx));
  // Dots only cover 5 content chapters (0-4); final CTA keeps last dot active
  const dotIdx = Math.min(idx, TOTAL_CHAPTERS - 2);
  dots.forEach((d) => d.classList.toggle('is-active', +d.dataset.chapter === dotIdx));

  const prevBtn = document.querySelector('.welcome-navbtn--prev');
  const nextBtn = document.querySelector('.welcome-navbtn--next');
  prevBtn?.classList.toggle('is-hidden', idx === 0);
  // Hide default Next on final chapter (CTA button is the action there)
  nextBtn?.classList.toggle('is-hidden', idx === FINAL_CHAPTER_INDEX);
  // Visually emphasize Next on the penultimate chapter
  nextBtn?.classList.toggle('is-final', idx === FINAL_CHAPTER_INDEX - 1);
  const nextLabel = nextBtn?.querySelector('[data-i18n]');
  if (nextLabel) {
    nextLabel.textContent = idx === FINAL_CHAPTER_INDEX - 1
      ? t('onboarding_cta_start') || 'Start using LumiNote'
      : t('onboarding_next') || 'Next';
  }
}

/* ─── Exit ─────────────────────────────────────────────────────── */

async function exitFlow({ skipped }) {
  await markComplete({ skipped, lastChapter: currentIndex });
  // Capture our own tab id BEFORE opening notebook. chrome.tabs.create defaults
  // to active:true → if we query "active tab" after, we'd find the notebook
  // and remove it, leaving the welcome page open. Using getCurrent() pins to
  // this welcome tab regardless of focus.
  let selfTabId = null;
  try {
    const self = await chrome.tabs.getCurrent();
    selfTabId = self?.id ?? null;
  } catch { /* fall back to window.close below */ }

  if (!skipped) {
    try {
      await chrome.tabs.create({ url: chrome.runtime.getURL('notebook/notebook.html') });
    } catch {}
  }

  try {
    if (selfTabId != null) await chrome.tabs.remove(selfTabId);
    else window.close();
  } catch { window.close(); }
}

/* ─── Chapter renderers ────────────────────────────────────────── */

const playedChapters = new Set();

function renderChapter2(stage, mock) {
  if (!mock) return;
  // Build article paragraphs, injecting the real .lumiread-revisit-highlight
  // around the highlightPhrase so it visually matches what a real Mark looks like.
  const paragraphs = (mock.paragraphs || []).map((p) => {
    const phrase = mock.highlightPhrase;
    if (phrase && p.includes(phrase)) {
      const parts = p.split(phrase);
      return `<p>${escapeHtml(parts[0])}<span class="lumiread-revisit-highlight">${escapeHtml(phrase)}</span>${escapeHtml(parts.slice(1).join(phrase))}</p>`;
    }
    return `<p>${escapeHtml(p)}</p>`;
  }).join('');

  stage.innerHTML = `
    <div class="ch2-article" role="img" aria-label="Mock article">
      <article class="ch2-article__page">
        <h1 class="ch2-article__title">${escapeHtml(mock.articleTitle || '')}</h1>
        <div class="ch2-article__meta">${escapeHtml(mock.articleMeta || '')}</div>
        ${paragraphs}
      </article>
      <div class="lumiread-bubble ch2-bubble">Mark</div>
      <div class="lumiread-card ch2-card">
        ${renderExplainCard(mock.explain, { relatedLabel: t('onboarding_ch2_card_related') })}
      </div>
    </div>
  `;
}

function renderChapter3(stage, mock) {
  if (!mock) return;
  const stages = (mock.funnelStages || []).map((s, i) => `
    <div class="ch3-funnel-stage" style="animation-delay: ${0.3 + i * 0.15}s;">
      <div class="ch3-funnel-label">${escapeHtml(s.label || '')}</div>
      <div class="ch3-funnel-note">${escapeHtml(s.note || '')}</div>
    </div>
  `).join('<div class="ch3-funnel-arrow" aria-hidden="true">→</div>');

  stage.innerHTML = `
    <div class="ch3-stage-inner">
      <div class="ch3-whiteboard" role="img" aria-label="${escapeHtml(mock.boardTitle || '')}">
        <div class="ch3-whiteboard__title">${escapeHtml(mock.boardTitle || '')}</div>
        <div class="ch3-funnel">${stages}</div>
      </div>
      <div class="lumiread-card ch3-card">
        ${renderExplainCard(mock.explain, { relatedLabel: t('onboarding_ch3_card_entities'), relatedKey: 'extractedEntities' })}
      </div>
    </div>
  `;
}

function renderChapter4(stage, mock) {
  if (!mock) return;
  const cards = (mock.cards || []).map((c, i) => `
    <div class="ch4-card" style="
      left:${c.x}%; top:${c.y}%; width:${c.w}%;
      animation-delay: ${0.2 + i * 0.08}s;
    ">
      <div class="ch4-card__title">${escapeHtml(c.title || '')}</div>
      <div class="ch4-card__body">${escapeHtml(c.body || '')}</div>
    </div>
  `).join('');

  stage.innerHTML = `
    <div class="ch4-stage-inner">
      <div class="ch4-board" role="img" aria-label="${escapeHtml(mock.boardName || '')}">
        <div class="ch4-board__toolbar">
          <span class="ch4-board__name">${escapeHtml(mock.boardName || '')}</span>
          <button class="ch4-board__export" disabled>Export PNG</button>
        </div>
        <div class="ch4-board__canvas">
          ${cards}
        </div>
      </div>
      <div class="ch4-hint">${escapeHtml(t('onboarding_ch4_hint_export') || mock.hint || '')}</div>
    </div>
  `;
  // Parallax pan on the canvas
  const canvas = stage.querySelector('.ch4-board__canvas');
  const container = stage.querySelector('.ch4-stage-inner');
  if (!canvas || !container) return;
  container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    canvas.style.transform = `translate(${-x * 8}px, ${-y * 6}px)`;
  });
  container.addEventListener('mouseleave', () => { canvas.style.transform = ''; });
}

function renderChapter5(stage, mock) {
  if (!mock) return;
  stage.innerHTML = `
    <div class="ch5-stage-inner">
      <div class="ch5-context">
        <span class="ch5-context__dot" aria-hidden="true"></span>
        <span class="ch5-context__label">${escapeHtml(mock.boardName || 'Welcome to LumiNote')}</span>
      </div>
      <div class="ch5-messages" id="ch5-messages"></div>
    </div>
  `;
  const list = stage.querySelector('#ch5-messages');
  let delay = 0;
  mock.messages.forEach((msg, i) => {
    const el = document.createElement('div');
    el.className = 'ch5-msg';
    el.style.animationDelay = `${delay}ms`;
    if (msg.role === 'user') {
      el.classList.add('ch5-msg--user');
      el.textContent = msg.text;
      delay += 450;
    } else if (msg.role === 'tool') {
      el.classList.add('ch5-msg--tool');
      el.textContent = `${msg.name} · ${msg.summary}`;
      delay += 350;
    } else {
      el.classList.add('ch5-msg--assistant');
      // For the last assistant message, add a faux streaming effect
      if (i === mock.messages.length - 1) {
        el.innerHTML = renderMd(msg.text) + '<span class="ch5-cursor"></span>';
      } else {
        el.innerHTML = renderMd(msg.text);
      }
      delay += 700;
    }
    list.appendChild(el);
  });
  // Remove blinking cursor after stream finishes
  setTimeout(() => {
    const cursor = stage.querySelector('.ch5-cursor');
    cursor?.remove();
  }, delay + 800);
}

/**
 * Render an Explain card body using the real CSS class names from content.css
 * so the mock is visually identical to the production card. Class reference:
 *   .lr-card-header / .lr-term
 *   .lr-content-area wraps body
 *   .lr-streaming-text = AI summary text block
 *   .lr-related-section / .lr-related-title / .lr-related-tags / .lr-related-tag
 *   .lr-source-label
 */
function renderExplainCard(explain, opts = {}) {
  const { relatedLabel = 'Related', relatedKey = 'related' } = opts;
  const related = explain[relatedKey] || [];
  return `
    <div class="lr-card-header">
      <div class="lr-term">${escapeHtml(explain.term || '')}</div>
    </div>
    <div class="lr-content-area">
      <div class="lr-streaming-text">${renderMd(explain.aiSummary || '')}</div>
      ${related.length ? `
        <div class="lr-related-section">
          <div class="lr-related-title">${escapeHtml(relatedLabel)}</div>
          <div class="lr-related-tags">
            ${related.map((r) => `<span class="lr-related-tag">${escapeHtml(r)}</span>`).join('')}
          </div>
        </div>` : ''}
    </div>
    ${explain.sourceLabel ? `<div class="lr-card-footer"><div class="lr-source-label">${escapeHtml(explain.sourceLabel)}</div></div>` : ''}
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ─── Lazy render on scroll-snap enter ─────────────────────────── */

function initChapterLazyRender() {
  const locale = getLocale();
  const mock = MOCK[locale] || MOCK.en;
  const renderers = {
    1: (stage) => renderChapter2(stage, mock.ch2),
    2: (stage) => renderChapter3(stage, mock.ch3),
    3: (stage) => renderChapter4(stage, mock.ch4),
    4: (stage) => renderChapter5(stage, mock.ch5),
  };

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const chap = +e.target.dataset.chapter;
      if (isNaN(chap)) continue;
      currentIndex = chap;
      syncChromeToIndex(chap);
      if (playedChapters.has(chap)) continue;
      playedChapters.add(chap);
      const stage = e.target.querySelector('.chapter__stage');
      if (stage && renderers[chap]) renderers[chap](stage);
    }
  }, { threshold: 0.55, root: deck });

  document.querySelectorAll('.chapter').forEach((el) => io.observe(el));
}

/* ─── Init ──────────────────────────────────────────────────────── */

async function init() {
  await initLocale();
  applyI18n();

  // Force flag resets the deck to chapter 0, bypasses completedAt gate
  const force = new URLSearchParams(location.search).has('force');
  const state = await loadState();
  if (!force && state.completedAt) {
    // Already completed — set last chapter so re-entering remembers where they were
    currentIndex = state.lastChapter ?? 0;
  }

  // Wire actions
  document.querySelectorAll('[data-action]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const action = e.currentTarget.dataset.action;
      if (action === 'next') goToChapter(currentIndex + 1);
      else if (action === 'prev') goToChapter(currentIndex - 1);
      else if (action === 'skip') exitFlow({ skipped: true });
      else if (action === 'finish') exitFlow({ skipped: false });
    });
  });
  dots.forEach((d) => d.addEventListener('click', () => goToChapter(+d.dataset.chapter)));

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      if (currentIndex === FINAL_CHAPTER_INDEX) exitFlow({ skipped: false });
      else goToChapter(currentIndex + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      goToChapter(currentIndex - 1);
    } else if (e.key === 'Escape') {
      exitFlow({ skipped: true });
    }
  });

  initChapterLazyRender();

  // Sync state on mount
  syncChromeToIndex(0);
}

init().catch((e) => console.error('[welcome] init failed', e));
