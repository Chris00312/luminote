#!/usr/bin/env node
/**
 * release.mjs — package the extension and publish a GitHub release.
 *
 * Reads the version from LumiNote/manifest.json, builds the zip, then creates
 * a GitHub release tagged v<version> with the zip attached. The README and the
 * marketing site both point at /releases/latest, so nothing else needs editing.
 *
 * Usage:
 *   node scripts/release.mjs                 # build + publish
 *   node scripts/release.mjs --dry-run       # build only, print what would happen
 *
 * Requires the GitHub CLI to be installed and authenticated (gh auth login).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ZIP = resolve(ROOT, 'website', 'downloads', 'luminote-chrome.zip');

function sh(cmd, args, opts = {}) {
  const out = execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', ...opts });
  return out == null ? '' : out.trim();
}

/* ─── Version ────────────────────────────────────────────────────── */

const manifest = JSON.parse(readFileSync(resolve(ROOT, 'LumiNote', 'manifest.json'), 'utf8'));
const version = manifest.version;
const tag = `v${version}`;
const dryRun = process.argv.includes('--dry-run');

console.log(`LumiNote ${tag}`);

/* ─── Build ──────────────────────────────────────────────────────── */

sh(process.execPath, [resolve(ROOT, 'scripts', 'package-extension.mjs')], { stdio: 'inherit' });

/* ─── Stage the asset under a versioned name ─────────────────────── */

const assetName = `luminote-${tag}.zip`;
const assetPath = join(tmpdir(), assetName);
copyFileSync(ZIP, assetPath);
console.log(`Asset: ${assetName}`);

if (dryRun) {
  console.log('\n--dry-run: skipping release. Would run:');
  console.log(`  gh release create ${tag} ${assetPath} --title "LumiNote ${tag}"`);
  process.exit(0);
}

/* ─── Guard: refuse to overwrite an existing release ─────────────── */

try {
  sh('gh', ['release', 'view', tag]);
  console.error(`\nRelease ${tag} already exists. Bump "version" in LumiNote/manifest.json first.`);
  process.exit(1);
} catch {
  // Not found — good, we can create it.
}

/* ─── Publish ────────────────────────────────────────────────────── */

sh('gh', [
  'release', 'create', tag, assetPath,
  '--title', `LumiNote ${tag}`,
  '--notes', [
    `下载 \`${assetName}\`，解压后在 \`chrome://extensions\` 打开开发者模式，`,
    '点「加载已解压的扩展程序」，选中解压出的 `luminote` 文件夹。',
    '',
    '首次使用请在设置中填入你自己的 AI API Key。',
  ].join('\n'),
], { stdio: 'inherit' });

console.log(`\nPublished: https://github.com/Chris00312/luminote/releases/tag/${tag}`);
