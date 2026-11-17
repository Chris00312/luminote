#!/usr/bin/env node
/**
 * package-extension.mjs — build the downloadable extension zip.
 *
 * Produces website/downloads/luminote-chrome.zip from LumiNote/. This is the
 * artefact the marketing site hands out: the user unzips it and loads it as an
 * unpacked extension (chrome://extensions → Developer mode → Load unpacked).
 *
 * Usage:
 *   node scripts/package-extension.mjs
 *
 * The zip is created with the extension files at the archive root, so unzipping
 * yields a ready-to-load folder.
 */

import { createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createDeflateRaw } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'LumiNote');
const OUT_DIR = path.join(ROOT, 'website', 'downloads');
const OUT_FILE = path.join(OUT_DIR, 'luminote-chrome.zip');
const FOLDER_NAME = 'luminote';

/* ─── Collect files to ship ──────────────────────────────────────── */

const SKIP_DIRS = new Set(['node_modules', '.git', '.DS_Store']);
const SKIP_FILES = new Set(['.DS_Store', 'stderr.log']);

async function walk(dir, base = '') {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...await walk(abs, rel));
    } else if (!SKIP_FILES.has(entry.name)) {
      out.push({ abs, rel });
    }
  }
  return out;
}

/* ─── Minimal ZIP writer (deflate, no dependencies) ───────────────

   The extension has no build step, so the zip is just a container. Writing it
   by hand keeps the repo free of archiver deps and works on any Node 18+.
   ───────────────────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function deflateRaw(buf) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const deflate = createDeflateRaw({ level: 9 });
    deflate.on('data', (c) => chunks.push(c));
    deflate.on('end', () => resolve(Buffer.concat(chunks)));
    deflate.on('error', reject);
    deflate.end(buf);
  });
}

function dosDateTime(date) {
  const time = ((date.getHours() & 0x1f) << 11)
    | ((date.getMinutes() & 0x3f) << 5)
    | ((date.getSeconds() / 2) & 0x1f);
  const day = (((date.getFullYear() - 1980) & 0x7f) << 9)
    | (((date.getMonth() + 1) & 0x0f) << 5)
    | (date.getDate() & 0x1f);
  return { time, day };
}

async function buildZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { time, day } = dosDateTime(new Date());

  for (const file of files) {
    const data = await readFile(file.abs);
    const compressed = await deflateRaw(data);
    // Store uncompressed when deflate does not help (tiny or already-compressed)
    const useDeflate = compressed.length < data.length;
    const payload = useDeflate ? compressed : data;
    const method = useDeflate ? 8 : 0;
    const nameBuf = Buffer.from(`${FOLDER_NAME}/${file.rel}`, 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);   // local file header signature
    local.writeUInt16LE(20, 4);           // version needed
    local.writeUInt16LE(0x0800, 6);       // UTF-8 filename flag
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    localParts.push(local, nameBuf, payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory signature
    central.writeUInt16LE(20, 4);         // version made by
    central.writeUInt16LE(20, 6);         // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);         // extra length
    central.writeUInt16LE(0, 32);         // comment length
    central.writeUInt16LE(0, 34);         // disk number
    central.writeUInt16LE(0, 36);         // internal attrs
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // external attrs (regular file 644)
    central.writeUInt32LE(offset, 42);

    centralParts.push(central, nameBuf);
    offset += local.length + nameBuf.length + payload.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);       // end of central directory
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuf, end]);
}

/* ─── Main ───────────────────────────────────────────────────────── */

const files = await walk(SRC_DIR);
if (!files.length) {
  console.error('No files found in LumiNote/ — nothing to package.');
  process.exit(1);
}

// Sanity check: a loadable extension must have a manifest.
if (!files.some((f) => f.rel === 'manifest.json')) {
  console.error('LumiNote/manifest.json is missing — refusing to build a broken package.');
  process.exit(1);
}

const zip = await buildZip(files);
await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_FILE, zip);

const size = (await stat(OUT_FILE)).size;
console.log(`Packaged ${files.length} files → ${path.relative(ROOT, OUT_FILE)}`);
console.log(`Size: ${(size / 1024 / 1024).toFixed(2)} MB`);
console.log('Extract it and load the folder via chrome://extensions → Load unpacked.');
