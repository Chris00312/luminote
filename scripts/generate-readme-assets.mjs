// Generate README header + badge assets.
//
// Writes docs/header.svg and docs/badges/*.svg, then converts them to PNG with
// rsvg-convert (so GitHub renders them at a stable size — it does not scale
// inline SVG reliably). Requires librsvg:  brew install librsvg
//
//   node scripts/generate-readme-assets.mjs

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DOCS = resolve(ROOT, 'docs');
const BADGES = resolve(DOCS, 'badges');
mkdirSync(BADGES, { recursive: true });

/* ─── Brand tokens (mirrors website/assets/colors_and_type.css) ──── */
const GREEN_DEEP = '#1a6b4a';
const GREEN_MID = '#228b5b';
const GREEN_BRIGHT = '#2fa373';
const INK = '#0f2a1d';

const FONT = "'Google Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/* ─── Header banner ─────────────────────────────────────────────── */

const headerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="420" viewBox="0 0 1280 420" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1280" y2="420" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#f2f8f4"/>
      <stop offset="0.45" stop-color="#e7f2ea"/>
      <stop offset="1" stop-color="#eef7f1"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GREEN_DEEP}"/>
      <stop offset="1" stop-color="${GREEN_BRIGHT}"/>
    </linearGradient>
    <radialGradient id="blob1" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${GREEN_DEEP}" stop-opacity="0.13"/>
      <stop offset="1" stop-color="${GREEN_DEEP}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="blob2" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${GREEN_BRIGHT}" stop-opacity="0.12"/>
      <stop offset="1" stop-color="${GREEN_BRIGHT}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1280" height="420" fill="url(#bg)"/>
  <circle cx="120" cy="-40" r="300" fill="url(#blob1)"/>
  <circle cx="1150" cy="440" r="340" fill="url(#blob2)"/>

  <!-- Logo tile -->
  <g transform="translate(80,72)">
    <rect width="64" height="64" rx="17" fill="url(#accent)"/>
    <g transform="translate(14,15)" stroke="#fff" stroke-width="2.6" stroke-linejoin="round" fill="none">
      <path d="M18 4L4 11l14 7 14-7-14-7z"/>
      <path d="M4 25l14 7 14-7"/>
      <path d="M4 18l14 7 14-7"/>
    </g>
    <text x="82" y="43" font-family="${FONT}" font-size="38" font-weight="700" fill="${INK}" letter-spacing="-0.6">LumiNote</text>
  </g>

  <!-- Eyebrow pill -->
  <g transform="translate(80,172)">
    <rect width="318" height="34" rx="17" fill="${GREEN_DEEP}" fill-opacity="0.09"/>
    <text x="18" y="23" font-family="${FONT}" font-size="14" font-weight="700" fill="${GREEN_DEEP}" letter-spacing="1.6">MARK · EXPLAIN · REMEMBER</text>
  </g>

  <!-- Headline -->
  <text x="80" y="262" font-family="${FONT}" font-size="52" font-weight="700" fill="${INK}" letter-spacing="-1.6">Mark any page,</text>
  <text x="80" y="322" font-family="${FONT}" font-size="52" font-weight="700" fill="${GREEN_DEEP}" letter-spacing="-1.6">let AI explain it.</text>

  <!-- Sub-line -->
  <text x="80" y="362" font-family="${FONT}" font-size="19" font-weight="400" fill="#4b5a52">Local-first browser memory library · bring your own API key · MIT licensed</text>

  <!-- Right: memory card stack -->
  <g transform="translate(760,86)">
    <rect x="0" y="0" width="440" height="252" rx="20" fill="#ffffff" fill-opacity="0.78" stroke="#cfe2d6"/>
    <rect x="0" y="0" width="440" height="42" rx="20" fill="#f4faf6"/>
    <rect x="0" y="21" width="440" height="21" fill="#f4faf6"/>
    <circle cx="24" cy="21" r="5" fill="#d8e6dd"/>
    <circle cx="42" cy="21" r="5" fill="#d8e6dd"/>
    <circle cx="60" cy="21" r="5" fill="#d8e6dd"/>
    <rect x="86" y="13" width="230" height="16" rx="8" fill="#e8f2ec"/>

    <!-- card 1 -->
    <g transform="translate(22,64)">
      <rect width="188" height="86" rx="12" fill="#fff" stroke="#dfeae3"/>
      <rect x="14" y="16" width="72" height="9" rx="4.5" fill="#cfe6d8"/>
      <rect x="14" y="34" width="146" height="7" rx="3.5" fill="#e3eee7"/>
      <rect x="14" y="48" width="128" height="7" rx="3.5" fill="#e3eee7"/>
      <rect x="14" y="64" width="58" height="8" rx="4" fill="${GREEN_DEEP}" fill-opacity="0.15"/>
    </g>
    <!-- card 2 -->
    <g transform="translate(228,64)">
      <rect width="188" height="86" rx="12" fill="#fff" stroke="#dfeae3"/>
      <rect x="14" y="16" width="60" height="9" rx="4.5" fill="#cfe6d8"/>
      <rect x="14" y="34" width="146" height="7" rx="3.5" fill="#e3eee7"/>
      <rect x="14" y="48" width="110" height="7" rx="3.5" fill="#e3eee7"/>
      <rect x="14" y="64" width="44" height="8" rx="4" fill="${GREEN_DEEP}" fill-opacity="0.15"/>
    </g>
    <!-- card 3 highlighted -->
    <g transform="translate(22,160)">
      <rect width="394" height="70" rx="12" fill="#fff" stroke="${GREEN_MID}" stroke-opacity="0.55"/>
      <rect x="14" y="14" width="46" height="8" rx="4" fill="${GREEN_DEEP}" fill-opacity="0.28"/>
      <rect x="14" y="30" width="336" height="7" rx="3.5" fill="#e3eee7"/>
      <rect x="14" y="44" width="268" height="7" rx="3.5" fill="#e3eee7"/>
      <g transform="translate(336,16)">
        <rect width="44" height="26" rx="13" fill="url(#accent)"/>
        <path d="M14 13l4.5 4.5L26 9" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </g>
    </g>
  </g>
</svg>`;

/* ─── Badges ────────────────────────────────────────────────────── */

function pillSvg(label, color = GREEN_DEEP) {
  const w = 26 + label.length * 8.6;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w)}" height="32" viewBox="0 0 ${Math.round(w)} 32">
  <rect width="${Math.round(w)}" height="32" rx="16" fill="#fff" stroke="${color}" stroke-opacity="0.28"/>
  <text x="${Math.round(w / 2)}" y="21" text-anchor="middle" font-family="${FONT}" font-size="13.5" font-weight="600" fill="${color}">${label}</text>
</svg>`;
}

const badgeDefs = [
  ['mit', pillSvg('MIT License')],
  ['local-first', pillSvg('Local-first')],
  ['byok', pillSvg('BYOK')],
  ['no-account', pillSvg('No account')],
];

/* ─── Render ────────────────────────────────────────────────────── */

writeFileSync(resolve(DOCS, 'header.svg'), headerSvg, 'utf8');
for (const [name, svg] of badgeDefs) writeFileSync(resolve(BADGES, `${name}.svg`), svg, 'utf8');

/* ─── Convert SVG → PNG ─────────────────────────────────────────── */

function toPng(svgPath, pngPath, width, height) {
  // 2× scale for crisp rendering on high-DPI displays
  execFileSync('rsvg-convert', [
    '-w', String(width * 2),
    '-h', String(height * 2),
    '-o', pngPath,
    svgPath,
  ], { stdio: 'inherit' });
  console.log('  →', pngPath.replace(ROOT + '/', ''));
}

try {
  toPng(resolve(DOCS, 'header.svg'), resolve(DOCS, 'header.png'), 1280, 420);
  for (const [name, svg] of badgeDefs) {
    const m = svg.match(/width="(\d+)" height="32"/);
    const w = Number(m[1]);
    toPng(resolve(BADGES, `${name}.svg`), resolve(BADGES, `${name}.png`), w, 32);
  }
} catch (e) {
  console.error('rsvg-convert failed. Install it with: brew install librsvg');
  process.exitCode = 1;
}

console.log('Done. Assets in docs/');
