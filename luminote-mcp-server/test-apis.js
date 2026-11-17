#!/usr/bin/env node
/**
 * End-to-end test for luminote-mcp-server.
 *
 * 1. Spawns the MCP server as a child process (communicating via stdio).
 * 2. Connects a fake "extension" via WebSocket to handle requests.
 * 3. Calls every MCP tool and verifies the responses.
 */

import { spawn } from "child_process";
import WebSocket from "ws";

const WS_PORT = 19960;
let reqCounter = 0;
let child;
let ws;

// In-memory store simulating chrome.storage
const memoryStore = [];

// ─── Fake extension: WebSocket client that handles requests ────────

function startFakeExtension() {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(`ws://127.0.0.1:${WS_PORT}`);
    ws.on("open", () => {
      console.log("[ext] Connected to MCP server WebSocket");
      resolve();
    });
    ws.on("error", reject);

    ws.on("message", (data) => {
      const msg = JSON.parse(data);
      const { _reqId, type, ...rest } = msg;
      console.log(`[ext] Received: ${type}`);

      let response;
      switch (type) {
        case "CREATE_MEMORY": {
          const id = `lr_${Date.now()}_test${Math.random().toString(36).slice(2, 6)}`;
          const entry = { id, timestamp: Date.now(), ...rest.block };
          memoryStore.push(entry);
          response = { ok: true, id };
          break;
        }
        case "UPDATE_MEMORY": {
          const idx = memoryStore.findIndex((e) => e.id === rest.id);
          if (idx === -1) {
            response = { ok: false, error: "Not found" };
          } else {
            const allowed = ["term", "note", "aiSummary", "tags"];
            for (const k of Object.keys(rest.fields || {})) {
              if (allowed.includes(k)) memoryStore[idx][k] = rest.fields[k];
            }
            response = { ok: true };
          }
          break;
        }
        case "DELETE_MEMORY": {
          const di = memoryStore.findIndex((e) => e.id === rest.id);
          if (di === -1) {
            response = { ok: false, error: "Not found" };
          } else {
            memoryStore.splice(di, 1);
            response = { ok: true };
          }
          break;
        }
        case "SEARCH_MEMORIES": {
          const q = (rest.query || "").toLowerCase();
          const results = memoryStore.filter(
            (e) =>
              (e.term || "").toLowerCase().includes(q) ||
              (e.note || "").toLowerCase().includes(q)
          );
          response = { ok: true, results, total: results.length };
          break;
        }
        case "GET_MEMORY": {
          const entry = memoryStore.find((e) => e.id === rest.id);
          response = entry ? { ok: true, memory: entry } : { ok: false, error: "Not found" };
          break;
        }
        case "OPEN_MEMORY": {
          const oe = memoryStore.find((e) => e.id === rest.id);
          response = oe
            ? { ok: true, sourceUrl: oe.sourceUrl, sourceTitle: oe.sourceTitle }
            : { ok: false, error: "Not found" };
          break;
        }
        default:
          response = { ok: false, error: `Unknown type: ${type}` };
      }

      ws.send(JSON.stringify({ _reqId, response }));
    });
  });
}

// ─── MCP Client: communicate via stdio with JSON-RPC ──────────────

function startMcpServer() {
  return new Promise((resolve) => {
    child = spawn("node", ["index.js"], {
      cwd: new URL(".", import.meta.url).pathname,
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stderr.on("data", (d) => {
      const line = d.toString().trim();
      if (line) console.log(`[server] ${line}`);
      // Wait until WebSocket is ready
      if (line.includes("WebSocket bridge listening")) {
        setTimeout(resolve, 500);
      }
    });

    child.on("exit", (code) => {
      if (code) console.log(`[server] Exited with code ${code}`);
    });
  });
}

function sendJsonRpc(method, params = {}) {
  const id = ++reqCounter;
  const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  child.stdin.write(msg + "\n");

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout on ${method}`)), 15000);

    let buffer = "";
    const handler = (data) => {
      buffer += data.toString();
      // Try to parse complete JSON-RPC responses
      const lines = buffer.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const resp = JSON.parse(line.trim());
          if (resp.id === id) {
            clearTimeout(timeout);
            child.stdout.removeListener("data", handler);
            resolve(resp);
            return;
          }
        } catch {
          // incomplete line, keep buffering
        }
      }
      // Keep last incomplete line in buffer
      buffer = lines[lines.length - 1];
    };
    child.stdout.on("data", handler);
  });
}

async function mcpInitialize() {
  const resp = await sendJsonRpc("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" },
  });
  console.log("[mcp] Initialized:", JSON.stringify(resp.result?.serverInfo));

  // Send initialized notification (no response expected)
  const msg = JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" });
  child.stdin.write(msg + "\n");
  await sleep(200);
}

async function mcpListTools() {
  const resp = await sendJsonRpc("tools/list", {});
  const tools = resp.result?.tools || [];
  console.log(`[mcp] Available tools: ${tools.map((t) => t.name).join(", ")}`);
  return tools;
}

async function mcpCallTool(name, args = {}) {
  const resp = await sendJsonRpc("tools/call", { name, arguments: args });
  const content = resp.result?.content?.[0]?.text;
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = content;
  }
  return { raw: resp, parsed, isError: resp.result?.isError };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Test runner ───────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n=== Starting MCP Server ===\n");
  await startMcpServer();

  console.log("\n=== Connecting Fake Extension ===\n");
  await startFakeExtension();
  await sleep(300);

  console.log("\n=== MCP Handshake ===\n");
  await mcpInitialize();

  console.log("\n=== List Tools ===\n");
  const tools = await mcpListTools();
  assert(tools.length === 6, `Found 6 tools (got ${tools.length})`);

  // --- Test 1: create_memory ---
  console.log("\n--- Test: create_memory ---");
  const createRes = await mcpCallTool("create_memory", {
    term: "Transformer Architecture",
    entryType: "text",
    sourceKind: "web",
    sourceUrl: "https://arxiv.org/abs/1706.03762",
    sourceTitle: "Attention Is All You Need",
    note: "Foundational transformer paper.",
    aiSummary: "Introduces the Transformer model.",
    context: "We propose a new simple network architecture...",
    tags: ["transformers", "attention"],
  });
  assert(createRes.parsed?.ok === true, "create_memory returned ok");
  assert(typeof createRes.parsed?.id === "string", `Got ID: ${createRes.parsed?.id}`);
  const createdId = createRes.parsed?.id;

  // --- Test 2: get_memory ---
  console.log("\n--- Test: get_memory ---");
  const getRes = await mcpCallTool("get_memory", { id: createdId });
  assert(getRes.parsed?.ok === true, "get_memory returned ok");
  assert(getRes.parsed?.memory?.term === "Transformer Architecture", "Term matches");
  assert(getRes.parsed?.memory?.note === "Foundational transformer paper.", "Note matches");

  // --- Test 3: update_memory ---
  console.log("\n--- Test: update_memory ---");
  const updateRes = await mcpCallTool("update_memory", {
    id: createdId,
    note: "Updated: Also relevant for ViT.",
    tags: ["transformers", "attention", "vision"],
  });
  assert(updateRes.parsed?.ok === true, "update_memory returned ok");

  // Verify update
  const getRes2 = await mcpCallTool("get_memory", { id: createdId });
  assert(getRes2.parsed?.memory?.note === "Updated: Also relevant for ViT.", "Note updated");
  assert(getRes2.parsed?.memory?.tags?.length === 3, "Tags updated (3 items)");

  // --- Test 4: search_memories ---
  console.log("\n--- Test: search_memories ---");
  // Create a second entry for search
  await mcpCallTool("create_memory", {
    term: "BERT",
    sourceKind: "web",
    sourceUrl: "https://arxiv.org/abs/1810.04805",
    note: "Bidirectional encoder model.",
    tags: ["nlp"],
  });

  const searchRes = await mcpCallTool("search_memories", { query: "transformer" });
  assert(searchRes.parsed?.ok === true, "search_memories returned ok");
  assert(searchRes.parsed?.total >= 1, `Found ${searchRes.parsed?.total} result(s)`);

  const searchRes2 = await mcpCallTool("search_memories", { query: "BERT" });
  assert(searchRes2.parsed?.total >= 1, "Found BERT entry");

  // --- Test 5: open_memory ---
  console.log("\n--- Test: open_memory ---");
  const openRes = await mcpCallTool("open_memory", { id: createdId });
  assert(openRes.parsed?.ok === true, "open_memory returned ok");
  assert(openRes.parsed?.sourceUrl === "https://arxiv.org/abs/1706.03762", "sourceUrl matches");

  // --- Test 6: delete_memory ---
  console.log("\n--- Test: delete_memory ---");
  const deleteRes = await mcpCallTool("delete_memory", { id: createdId });
  assert(deleteRes.parsed?.ok === true, "delete_memory returned ok");

  // Verify deletion
  const getRes3 = await mcpCallTool("get_memory", { id: createdId });
  assert(getRes3.parsed?.ok === false, "Deleted memory returns not found");

  // --- Summary ---
  console.log(`\n========================================`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  // Cleanup
  ws.close();
  child.kill();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Test error:", err);
  if (ws) ws.close();
  if (child) child.kill();
  process.exit(1);
});
