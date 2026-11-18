#!/usr/bin/env node
/**
 * Smoke test — what a registry like Glama actually checks.
 *
 * Boots the server over stdio, runs the MCP handshake, and asserts that
 * `tools/list` returns every tool. This is the regression test for the bug
 * where an undeclared `zod` resolved to v4 and made `tools/list` return
 * `Cannot read properties of undefined (reading '_zod')`.
 *
 *   node test-smoke.mjs
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const EXPECTED_TOOLS = [
  'create_memory', 'update_memory', 'delete_memory', 'search_memories',
  'get_memory', 'open_memory', 'list_moodboard_sessions', 'get_moodboard_session',
  'create_moodboard_session', 'update_moodboard_session', 'delete_moodboard_session',
  'add_moodboard_card', 'remove_moodboard_card',
];

const child = spawn(process.execPath, [join(here, 'index.js')], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buffer = '';
const responses = new Map();
const done = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('timed out after 15s')), 15000);

  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    let nl;
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.id !== undefined) {
        responses.set(msg.id, msg);
        if (responses.size === 3) { clearTimeout(timer); resolve(); }
      }
    }
  });

  child.on('error', reject);
});

const send = (obj) => child.stdin.write(JSON.stringify(obj) + '\n');

send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
  protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke', version: '1' },
}});
send({ jsonrpc: '2.0', method: 'notifications/initialized' });
send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
send({ jsonrpc: '2.0', id: 3, method: 'resources/list' });

let failed = false;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed = true;
};

try {
  await done;

  const init = responses.get(1);
  check('initialize responds', !!init?.result, init?.result?.serverInfo?.name);

  const list = responses.get(2);
  if (list?.error) {
    check('tools/list succeeds', false, list.error.message);
  } else {
    const names = (list?.result?.tools ?? []).map((t) => t.name);
    check('tools/list succeeds', true, `${names.length} tools`);
    const missing = EXPECTED_TOOLS.filter((n) => !names.includes(n));
    check('all expected tools registered', missing.length === 0, missing.join(', ') || 'none missing');
  }

  const res = responses.get(3);
  check('resources/list succeeds', !!res?.result, (res?.result?.resources ?? []).map((r) => r.uri).join(', '));
} catch (err) {
  check('server responds within timeout', false, err.message);
}

child.kill('SIGKILL');
process.exit(failed ? 1 : 0);
