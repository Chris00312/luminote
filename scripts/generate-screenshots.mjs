// Generate README / listing screenshots from the local marketing site.
//
// Prereq: serve website/ locally, then:
//   python3 -m http.server 8765 --directory website
//   node scripts/generate-screenshots.mjs
//
// Uses playwright-core against the locally installed Google Chrome, so no
// Chromium download is needed. Output lands in docs/screenshots/.
//
// Sections captured (all free of any pricing/quota content):
//   hero, flow, demo, interfaces, agent, download

import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'docs/screenshots');
mkdirSync(OUT, { recursive: true });

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8765';
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function waitForHero(page) {
  await page.waitForSelector('h1', { timeout: 20000 });
  await page.waitForTimeout(1200);
}

async function setEnglish(context) {
  await context.addInitScript(() => {
    try { localStorage.setItem('ln-lang', 'en'); } catch {}
  });
}

/** Isolate one section and screenshot it. */
async function sectionShot(page, keep, file, { pinHeroPhase = false, height = 800 } = {}) {
  await page.setViewportSize({ width: 1280, height });
  await page.evaluate((keep) => {
    document.getElementById('_shot_isolate')?.remove();
    const s = document.createElement('style');
    s.id = '_shot_isolate';
    s.textContent = `
      #app > :not(section) { display: none !important; }
      #app > section:not(${keep}) { display: none !important; }
    `;
    document.head.appendChild(s);
    window.scrollTo(0, 0);
  }, keep);

  if (pinHeroPhase) {
    // The hero runs a 6-phase loop; freeze it on the final moodboard phase.
    await page.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < 80; i++) {
        await wait(150);
        const hit = Array.from(document.querySelectorAll('*')).some(
          (el) => el.textContent && /^\s*06\s*·\s*(落到|Lands)/.test(el.textContent)
        );
        if (hit) {
          const hi = setTimeout(() => {}, 60000);
          for (let t = 1; t <= hi; t++) clearTimeout(t);
          return true;
        }
      }
      return false;
    });
    await page.waitForTimeout(700);
  } else {
    await page.waitForTimeout(600);
  }

  await page.screenshot({ path: file, type: 'png', fullPage: false });
  console.log('  →', file.replace(ROOT + '/', ''));
}

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--force-color-profile=srgb', '--hide-scrollbars'],
  });

  try {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });
    await setEnglish(ctx);
    const page = await ctx.newPage();

    console.log(`Screenshots from ${BASE} @ 1280×800 (EN)`);
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await waitForHero(page);

    // Strip marketing chrome so shots read as product, not website
    await page.addStyleTag({ content: `
      nav { display: none !important; }
      .bg-blobs { display: none !important; }
      body { background: var(--ln-bg-app) !important; }
    ` });
    await page.waitForTimeout(300);

    // `:first-of-type` targets the id-less Hero section
    const shots = [
      { keep: ':first-of-type', file: 'hero.png',           pinHeroPhase: true },
      { keep: '#flow',          file: 'how-it-works.png' },
      { keep: '#demo',          file: 'live-demo.png' },
      { keep: '#interfaces',    file: 'interfaces.png' },
      { keep: '#agent',         file: 'agent-mcp.png' },
      { keep: '#download',      file: 'download.png' },
    ];
    for (const s of shots) {
      await sectionShot(page, s.keep, resolve(OUT, s.file), { pinHeroPhase: s.pinHeroPhase });
    }

    await ctx.close();
  } finally {
    await browser.close();
  }
  console.log('Done. Assets in docs/screenshots/');
})();
