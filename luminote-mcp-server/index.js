#!/usr/bin/env node
/**
 * LumiNote MCP Server
 *
 * Bridges AI agents (Claude, OpenClaw, etc.) to the LumiNote Chrome extension.
 *
 * Architecture:
 *   AI Agent ←(MCP stdio)→ this server ←(WebSocket :19960)→ Chrome Extension
 *
 * The Chrome extension's service worker connects to ws://localhost:19960.
 * When an MCP tool is called, the server forwards it to the extension via
 * WebSocket and returns the response.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebSocketServer } from "ws";
import { z } from "zod";
import { execSync } from "child_process";

const WS_PORT = 19960;
const REQUEST_TIMEOUT = 10_000;

// ─── Kill any process already holding the port ────────────────────

function killPortHolder(port) {
  try {
    const isWin = process.platform === "win32";
    if (isWin) {
      const out = execSync(
        `netstat -ano | findstr :${port} | findstr LISTENING`,
        { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
      ).trim();
      const pid = out.trim().split(/\s+/).pop();
      if (pid && pid !== String(process.pid)) {
        execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
        console.error(`[luminote-mcp] Killed stale process PID ${pid} on port ${port}`);
      }
    } else {
      // macOS: fuser doesn't support /tcp syntax; use lsof instead
      execSync(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, { stdio: "ignore" });
    }
  } catch {
    // ignore — port may not be in use
  }
}

killPortHolder(WS_PORT);

// ─── WebSocket bridge ──────────────────────────────────────────────

let extensionSocket = null;
let pendingRequests = new Map();
let requestId = 0;

const wss = new WebSocketServer({ port: WS_PORT, host: "127.0.0.1" });

wss.on("listening", () => {
  console.error(`[luminote-mcp] WebSocket bridge listening on ws://127.0.0.1:${WS_PORT}`);
});

wss.on("error", (err) => {
  console.error("[luminote-mcp] WebSocket server error:", err.message);
  // If port is still occupied after killPortHolder, exit so Claude restarts a clean process
  if (err.code === "EADDRINUSE") {
    console.error(`[luminote-mcp] Port ${WS_PORT} still in use — exiting so the process restarts cleanly.`);
    process.exit(1);
  }
});

wss.on("connection", (ws) => {
  extensionSocket = ws;
  console.error("[luminote-mcp] Extension connected via WebSocket");

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg._reqId != null && pendingRequests.has(msg._reqId)) {
        const { resolve } = pendingRequests.get(msg._reqId);
        pendingRequests.delete(msg._reqId);
        resolve(msg.response);
      }
    } catch (e) {
      console.error("[luminote-mcp] Bad message from extension:", e.message);
    }
  });

  ws.on("close", () => {
    console.error("[luminote-mcp] Extension disconnected");
    extensionSocket = null;
    // Reject all pending requests
    for (const [id, { reject }] of pendingRequests) {
      reject(new Error("Extension disconnected"));
      pendingRequests.delete(id);
    }
  });
});

/**
 * Send a message to the Chrome extension and await the response.
 */
function sendToExtension(message) {
  return new Promise((resolve, reject) => {
    if (!extensionSocket || extensionSocket.readyState !== 1) {
      return reject(new Error(
        "LumiNote extension is not connected. Please open the LumiNote notebook page " +
        "in Chrome to establish the WebSocket bridge."
      ));
    }

    const id = ++requestId;
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error("Request timed out — extension did not respond within 10 s"));
    }, REQUEST_TIMEOUT);

    pendingRequests.set(id, {
      resolve: (val) => { clearTimeout(timer); resolve(val); },
      reject:  (err) => { clearTimeout(timer); reject(err); },
    });

    extensionSocket.send(JSON.stringify({ _reqId: id, ...message }));
  });
}

// ─── MCP Server ────────────────────────────────────────────────────

const server = new McpServer({
  name: "luminote",
  version: "1.0.0",
});

// --- Tool: create_memory ---
server.tool(
  "create_memory",
  "Create a new Memory Block in LumiNote. Returns the generated ID.",
  {
    term:        z.string().describe("The highlighted term or title"),
    entryType:   z.enum(["text", "image"]).default("text").describe("Type of memory entry"),
    sourceKind:  z.enum(["web", "pdf"]).default("web").describe("Source type"),
    sourceUrl:   z.string().optional().describe("URL of the source page"),
    sourceTitle: z.string().optional().describe("Title of the source page"),
    note:        z.string().optional().describe("Human-readable note"),
    aiSummary:   z.string().optional().describe("AI-generated summary"),
    context:     z.string().optional().describe("Surrounding paragraph captured at mark time"),
    tags:        z.array(z.string()).default([]).describe("Tags for categorization"),
  },
  async (params) => {
    try {
      const res = await sendToExtension({ type: "CREATE_MEMORY", block: params });
      return { content: [{ type: "text", text: JSON.stringify(res ?? null, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// --- Tool: update_memory ---
server.tool(
  "update_memory",
  "Update mutable fields of an existing Memory Block (term, note, aiSummary, tags).",
  {
    id:        z.string().describe("Memory Block ID (e.g. lr_1744027620000_abc1234)"),
    term:      z.string().optional().describe("New title / term"),
    note:      z.string().optional().describe("Updated note"),
    aiSummary: z.string().optional().describe("Updated AI summary"),
    tags:      z.array(z.string()).optional().describe("Updated tags"),
  },
  async ({ id, ...fields }) => {
    try {
      const res = await sendToExtension({ type: "UPDATE_MEMORY", id, fields });
      return { content: [{ type: "text", text: JSON.stringify(res ?? null, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// --- Tool: delete_memory ---
server.tool(
  "delete_memory",
  "Permanently delete a Memory Block from the library.",
  {
    id: z.string().describe("Memory Block ID to delete"),
  },
  async ({ id }) => {
    try {
      const res = await sendToExtension({ type: "DELETE_MEMORY", id });
      return { content: [{ type: "text", text: JSON.stringify(res ?? null, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// --- Tool: search_memories ---
server.tool(
  "search_memories",
  "Search Memory Blocks by keyword across term, note, aiSummary, and context. Supports filters.",
  {
    query:      z.string().optional().describe("Search keyword (searches term, note, aiSummary, context)"),
    sourceKind: z.enum(["web", "pdf"]).optional().describe("Filter by source type"),
    entryType:  z.enum(["text", "image"]).optional().describe("Filter by entry type"),
    domain:     z.string().optional().describe("Filter by source domain"),
    dateFrom:   z.string().optional().describe("ISO date string — only return entries after this date"),
    dateTo:     z.string().optional().describe("ISO date string — only return entries before this date"),
    limit:      z.number().default(20).describe("Max results to return"),
  },
  async (params) => {
    try {
      const { query, ...filters } = params;
      const res = await sendToExtension({ type: "SEARCH_MEMORIES", query, filters });
      return { content: [{ type: "text", text: JSON.stringify(res ?? null, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// --- Tool: get_memory ---
server.tool(
  "get_memory",
  "Retrieve the full Memory Block by ID, including note, AI summary, anchor, and locator.",
  {
    id: z.string().describe("Memory Block ID"),
  },
  async ({ id }) => {
    try {
      const res = await sendToExtension({ type: "GET_MEMORY", id });
      return { content: [{ type: "text", text: JSON.stringify(res ?? null, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// --- Tool: open_memory ---
server.tool(
  "open_memory",
  "Open the original source page/PDF of a Memory Block in a new Chrome tab.",
  {
    id: z.string().describe("Memory Block ID"),
  },
  async ({ id }) => {
    try {
      const res = await sendToExtension({ type: "OPEN_MEMORY", id });
      return { content: [{ type: "text", text: JSON.stringify(res ?? null, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ─── Moodboard Tools ──────────────────────────────────────────────

// --- Tool: list_moodboard_sessions ---
server.tool(
  "list_moodboard_sessions",
  "List all Moodboard (灵感板) sessions. Returns id, name, timestamps, and card count for each session.",
  {},
  async () => {
    try {
      const res = await sendToExtension({ type: "LIST_MOODBOARD_SESSIONS" });
      return { content: [{ type: "text", text: JSON.stringify(res ?? null, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// --- Tool: get_moodboard_session ---
server.tool(
  "get_moodboard_session",
  "Get full details of a Moodboard session, including all cards with their associated memory entries.",
  {
    id: z.string().describe("Moodboard session ID (e.g. mb_1706000000000_xyz9876)"),
  },
  async ({ id }) => {
    try {
      const res = await sendToExtension({ type: "GET_MOODBOARD_SESSION", id });
      return { content: [{ type: "text", text: JSON.stringify(res ?? null, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// --- Tool: create_moodboard_session ---
server.tool(
  "create_moodboard_session",
  "Create a new Moodboard session (an infinite canvas board for organizing memory entries spatially).",
  {
    name: z.string().optional().describe("Board name (defaults to 'Untitled Board')"),
  },
  async ({ name }) => {
    try {
      const res = await sendToExtension({ type: "CREATE_MOODBOARD_SESSION", name });
      return { content: [{ type: "text", text: JSON.stringify(res ?? null, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// --- Tool: update_moodboard_session ---
server.tool(
  "update_moodboard_session",
  "Update a Moodboard session's name or viewport (pan/zoom state).",
  {
    id:       z.string().describe("Moodboard session ID"),
    name:     z.string().optional().describe("New board name"),
    viewport: z.object({
      x:    z.number().describe("Pan X offset in pixels"),
      y:    z.number().describe("Pan Y offset in pixels"),
      zoom: z.number().describe("Zoom level (0.15 to 3)"),
    }).optional().describe("Viewport state"),
  },
  async ({ id, ...fields }) => {
    try {
      const res = await sendToExtension({ type: "UPDATE_MOODBOARD_SESSION", id, fields });
      return { content: [{ type: "text", text: JSON.stringify(res ?? null, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// --- Tool: delete_moodboard_session ---
server.tool(
  "delete_moodboard_session",
  "Permanently delete a Moodboard session and all its card placements.",
  {
    id: z.string().describe("Moodboard session ID to delete"),
  },
  async ({ id }) => {
    try {
      const res = await sendToExtension({ type: "DELETE_MOODBOARD_SESSION", id });
      return { content: [{ type: "text", text: JSON.stringify(res ?? null, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// --- Tool: add_moodboard_card ---
server.tool(
  "add_moodboard_card",
  "Add a Memory Block to a Moodboard session as a card at a specific canvas position.",
  {
    sessionId: z.string().describe("Moodboard session ID"),
    entryId:   z.string().describe("Memory Block ID to place on the board"),
    x:         z.number().default(0).describe("Canvas X position in pixels"),
    y:         z.number().default(0).describe("Canvas Y position in pixels"),
  },
  async (params) => {
    try {
      const res = await sendToExtension({ type: "ADD_MOODBOARD_CARD", ...params });
      return { content: [{ type: "text", text: JSON.stringify(res ?? null, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// --- Tool: remove_moodboard_card ---
server.tool(
  "remove_moodboard_card",
  "Remove a card from a Moodboard session (does not delete the underlying Memory Block).",
  {
    sessionId: z.string().describe("Moodboard session ID"),
    cardId:    z.string().describe("Card ID to remove (e.g. mbc_1706000000000_abc1234)"),
  },
  async (params) => {
    try {
      const res = await sendToExtension({ type: "REMOVE_MOODBOARD_CARD", ...params });
      return { content: [{ type: "text", text: JSON.stringify(res ?? null, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// --- Resource: memory://status ---
server.resource(
  "status",
  "memory://status",
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify({
        connected: extensionSocket?.readyState === 1,
        pendingRequests: pendingRequests.size,
        wsPort: WS_PORT,
      }),
    }],
  })
);

// ─── Start ─────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[luminote-mcp] MCP server running on stdio");
