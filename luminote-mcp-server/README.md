# LumiNote MCP Server

Bridge AI agents to the [LumiNote](https://github.com/Chris00312/luminote) Chrome extension via the
[Model Context Protocol](https://modelcontextprotocol.io). Let Claude Desktop, Cursor, or any MCP
client search and edit the memory cards you saved from your browser — completely locally.

```
AI Agent ←(MCP stdio)→ luminote-mcp-server ←(WebSocket :19960)→ Chrome Extension
```

The MCP server runs on your machine and talks to the extension over a WebSocket bridge on
`ws://127.0.0.1:19960`. Nothing leaves your computer, and no API key is involved — the extension
already talks to your own AI provider.

## Install

```bash
npm install -g luminote-mcp-server
```

Or run it without installing:

```bash
npx -y luminote-mcp-server
```

## Configure your MCP client

Claude Desktop (`claude_desktop_config.json`), Cursor (`~/.cursor/mcp.json`), or any other client:

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

## Connect the extension

Install the [LumiNote extension](https://github.com/Chris00312/luminote#install), then open its
notebook page in Chrome. The extension connects to the server's WebSocket automatically.

## Tools

### Memory blocks

| Tool | Description |
| :--- | :--- |
| `create_memory` | Create a new Memory Block |
| `update_memory` | Update mutable fields (term, note, aiSummary, tags) |
| `delete_memory` | Permanently delete a Memory Block |
| `search_memories` | Search by keyword, filtered by source kind, domain, or date range |
| `get_memory` | Retrieve a full Memory Block by ID |
| `open_memory` | Open the original source page or PDF in Chrome |

### Moodboards

| Tool | Description |
| :--- | :--- |
| `list_moodboard_sessions` | List every board |
| `get_moodboard_session` | Read one board and its cards |
| `create_moodboard_session` | Create a board |
| `update_moodboard_session` | Rename a board or change its layout |
| `delete_moodboard_session` | Delete a board |
| `add_moodboard_card` | Place a memory card (by `entryId`) or a widget card (`task` / `todo` / `priority` / `note`) at a canvas position |
| `remove_moodboard_card` | Remove a card from a board |

## Resources

| Resource | Description |
| :--- | :--- |
| `memory://status` | Whether the extension is connected |

## How it works

1. The server starts a WebSocket server on `127.0.0.1:19960`.
2. The LumiNote extension's service worker connects to it.
3. When an agent calls an MCP tool, the server forwards the request to the extension.
4. The extension handles it with `chrome.storage` and returns the result.
5. The server sends the result back to the agent.

## Development

```bash
git clone https://github.com/Chris00312/luminote.git
cd luminote/luminote-mcp-server
npm install
npm start
```

## License

MIT
