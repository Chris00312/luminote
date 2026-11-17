# LumiNote MCP Server

Bridge AI agents to the [LumiNote](../README.md) Chrome extension via the [Model Context Protocol](https://modelcontextprotocol.io).

## Architecture

```
AI Agent ←(MCP stdio)→ luminote-mcp-server ←(WebSocket :19960)→ Chrome Extension
```

The MCP server runs locally and communicates with the LumiNote extension through a WebSocket bridge on `ws://127.0.0.1:19960`.

## Quick Start

### 1. Install

```bash
npm install -g luminote-mcp-server
```

Or run directly with npx:

```bash
npx luminote-mcp-server
```

### 2. Configure your AI agent

Add to your MCP client config (e.g. Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "luminote": {
      "command": "npx",
      "args": ["-y", "luminote-mcp-server"]
    }
  }
}
```

### 3. Connect the extension

Open the LumiNote notebook page in Chrome. The extension automatically connects to the MCP server's WebSocket bridge.

## Available Tools

| Tool | Description |
|------|-------------|
| `create_memory` | Create a new Memory Block |
| `update_memory` | Update mutable fields (term, note, aiSummary, tags) |
| `delete_memory` | Permanently delete a Memory Block |
| `search_memories` | Search by keyword with filters (sourceKind, domain, date range) |
| `get_memory` | Retrieve full Memory Block by ID |
| `open_memory` | Open original source page/PDF in Chrome |

## Resources

| Resource | Description |
|----------|-------------|
| `memory://status` | Check extension connection status |

## How It Works

1. The MCP server starts a WebSocket server on `127.0.0.1:19960`
2. The LumiNote Chrome extension's service worker connects to this WebSocket
3. When an AI agent calls an MCP tool, the server forwards the request to the extension
4. The extension processes the request using `chrome.storage` APIs and returns the result
5. The MCP server sends the result back to the AI agent

## License

MIT
