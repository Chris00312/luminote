# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately through GitHub's [private vulnerability reporting](https://github.com/Chris00312/luminote/security/advisories/new)
(Security → Advisories → Report a vulnerability), or email the maintainer listed on the
[GitHub profile](https://github.com/Chris00312).

You can expect an acknowledgement within a few days. Once a fix is ready, the advisory will be
published alongside the release so users know to update.

## What matters most here

LumiNote runs as a content script on every page (`<all_urls>`) and holds the user's AI API key, so
these classes of bug are treated as high severity:

| Class | Why it is serious |
| :--- | :--- |
| Injecting page content into the extension UI as HTML | The selection bubble renders text from arbitrary pages |
| Leaking the API key to a page, a log, or a third party | The key lives in `chrome.storage.sync` |
| Sending memory data anywhere except the user's configured AI provider | Local-first is the core promise |
| MCP bridge (`ws://127.0.0.1:19960`) accepting non-local or unauthenticated callers | It can read and write the memory store |
| Escaping `chrome.storage` bounds, or data loss on upgrade | Users have no server copy to restore from |

## Out of scope

- The extension is **unpacked and unminified by design**, so reading the code is not a finding.
- A vulnerable version of a bundled third-party library that has no reachable attack path in
  LumiNote's usage — still worth reporting, but lower priority.
- Anything that requires the user to paste a malicious prompt into the AI card themselves.
- The AI provider's own behaviour (quality of explanations, prompt-injection through page text that
  the provider handles) — see the note below.

## Known design boundary

Page text is sent to whichever AI provider the user configured. That is the product working as
designed, and it is documented in the README. A page can try to influence an explanation through
prompt injection; LumiNote does not claim to defend against that, and explanations should not be
treated as trusted instructions.

## Supported versions

The latest release on the [Releases page](https://github.com/Chris00312/luminote/releases/latest)
receives fixes. Because the extension is installed unpacked and does not auto-update, an advisory
will always name the version that fixes the issue.
