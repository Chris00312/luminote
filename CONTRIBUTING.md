# Contributing to LumiNote

Thanks for taking the time. There is no heavy process here.

- **Small changes** (typos, styling, docs): open a PR directly, no need to ask first.
- **Large changes** (new features, refactors, data model changes): open an issue explaining the
  problem first, so we can agree on the direction before you write code.

中文贡献指南见 [CONTRIBUTING.zh-CN.md](CONTRIBUTING.zh-CN.md)。

## Local development

The extension has **no build step**.

```bash
git clone https://github.com/Chris00312/luminote.git
cd luminote
```

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and select the `LumiNote/` directory
4. After editing, click the refresh button on the extension card

If you are touching the MCP server too:

```bash
cd luminote-mcp-server
npm install
node index.js
```

## Before you open a PR

```bash
node scripts/package-extension.mjs    # packaging still works
node --check LumiNote/lib/*.js        # syntax is fine
```

CI runs these on every push. If you changed the UI, include a screenshot.

## Non-negotiable constraints

These are the product's positioning, not preferences:

- **No accounts, no servers, no telemetry.** Data stays on the user's machine.
- **No paid tiers, subscriptions or quotas.** This is the free open-source build.
- **AI calls only ever use the user's own key.** Never commit or hard-code an API key.
- **Do not break existing data.** A user's stored memories and boards must survive an upgrade.

## Code style

- Match what is already there: 2-space indent, ES modules.
- Comments explain **why**, not **what**.
- English and Chinese comments are both fine.

## Commit messages

```
feat: what was added
fix: what was fixed
docs: documentation
chore: housekeeping
```

Short is fine, but the *why* should be clear.

## License

By opening a PR you agree to license your contribution under [MIT](LICENSE).
