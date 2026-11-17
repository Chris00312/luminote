# LumiNote Design System

> **LumiNote** is an AI-native, mark-and-explain memory layer for the open web. A Chrome extension that lets you select text or images on any page (or PDF), get layered AI explanations, and arrange the resulting "memory cards" on an infinite glassmorphic moodboard. A built-in Agent (and an MCP server) can read and write the same memory store from Claude Desktop, Cursor, etc.

This is the design system that powers it: tokens, type, color, components, and high-fidelity recreations of the eight core surfaces.

---

## Sources

Everything here was derived from the live extension codebase:

- **Repo:** [`Chris00312/AIChromeResearchPlugin`](https://github.com/Chris00312/AIChromeResearchPlugin) — branch `main`, folder `LumiNote/`
- Key files read: `manifest.json`, `styles/md3-tokens.css`, `popup/popup.{html,css}`, `notebook/notebook.{html,css}`, `notebook/moodboard.css`, `content/explain-card.css`, `content/mark-bubble.css`, `options/options.{html,css}`, `welcome/welcome.{html,css}`, `pdf-viewer/pdf-viewer.{html,css}`.
- The product copy and marketing description were provided by the LumiNote team in the project brief.

If you have repo access, treat that codebase as the source of truth — this design system is a faithful, slightly tightened recreation of what's in there.

---

## Index

```
LumiNote Design System/
├── README.md                  ← you are here
├── SKILL.md                   ← reusable skill manifest
├── colors_and_type.css        ← all CSS custom properties (tokens)
├── assets/                    ← logos, icon glyphs, brand images
├── preview/                   ← cards rendered into the Design System tab
│   ├── colors-*.html
│   ├── type-*.html
│   ├── spacing-*.html, radius.html, elevation.html, motion.html
│   └── components-*.html
└── ui_kits/
    ├── popup/                 ← 400×600 toolbar popup
    ├── explain/               ← in-page mark bubble + explain card
    ├── notebook/              ← full-page notebook + moodboard
    └── notebook/              ← full-page notebook + moodboard
```

---

## Product surfaces

LumiNote ships **eight core surfaces**. The UI kits cover the four highest-leverage ones; everything else can be assembled from the same component vocabulary.

| # | Surface | What it is | In UI kit? |
|---|---|---|---|
| 1 | **Popup** (400×600) | Mini notebook from the toolbar icon | ✅ `popup/` |
| 2 | **Mark Bubble** | Green pill that floats next to a selection | ✅ `explain/` |
| 3 | **Explain Card** | AI explanation card injected over any page | ✅ `explain/` |
| 4 | **Notebook** (full page) | Today/Calendar/Day timeline + Moodboard sidebar + embedded settings | ✅ `notebook/` |
| 5 | **Moodboard Canvas** | Infinite glass-card canvas, multiselect, drag, export | ✅ `notebook/` |
| 6 | **Agent Chat Panel** | Slides in from right; inline tool-call receipts | partial (in `notebook/`) |
| 7 | **Options / Settings** | AI provider + key, model, language, shortcuts, export | — |
| 8 | **PDF Viewer** | Self-hosted pdf.js with FAB (Note / Screenshot / Settings) | — |
| 9 | **Welcome / Onboarding** | 5-chapter horizontal scroll-snap deck | — |

---

## Content fundamentals

LumiNote talks like a thoughtful tool, not a hype product. Copy is **dense, calm, and bilingual-friendly** (Chinese & English ship side-by-side and the UI is built around `data-i18n` slots).

**Tone**
- **Quietly confident.** "Choose your plan" / "Compare features and pick the one that fits you best." Not "Unlock your potential!" — never exclamation marks in product UI.
- **Plain functional verbs** as button labels: *Mark*, *Save*, *Sync Now*, *Sign in with Google*, *Export as JSON*, *View plans*, *Test Connection*. Single verb where possible.
- **Specific, never marketing-fluffy** in feature lists: "50 AI calls/day", "Auto tags + knowledge graph", "Cancel anytime from the Customer Portal. Taxes may apply."
- Bilingual copy is parallel, never mixed mid-sentence. CN: "登录以同步数据并使用免费 AI 功能" / EN: "Sign in to sync data and use free AI features." Hints often stay in CN even when surrounding chrome is EN — the codebase ships `i18n.js` slots and a default Chinese fallback.

**Casing**
- Sentence case for headings and buttons: *"Cloud Sync"*, *"Subscription"*, *"Choose your plan"* — title-case ONLY for proper nouns (LumiNote, Pro, Max, Free, Google, Claude, Gemini).
- ALL-CAPS reserved for tier badges (`FREE`, `PRO`, `MAX`) and tiny eyebrow labels — always in `Google Sans` 700, ~11px, with letter-spacing.
- Code, model names, and provider IDs in mono: `gpt-4o-mini`, `deepseek-chat`, `chrome://extensions/shortcuts`.

**Voice**
- Second person, **never** first. "Your data belongs to you." "Sign in to sync." Never "Let me…" or "I'll…".
- Empty states show a poetic gloss in CN over a calm explanation in EN — e.g. moodboard empty: *"灵感板还是空的"* / *"Drag memories here from the right rail to start composing."*
- Errors are matter-of-fact — `test-result--error` with a short reason. No apology, no exclamation.

**Emoji** — essentially never. The product brief specifies no emoji in the UI; the actual codebase contains zero emoji in production strings. Iconography is SVG only.

**Numbers and units** — always concrete. "$8/month", "50 AI calls/day", "3 Moodboards", "−25%" (with a real minus, not a hyphen, on the yearly toggle).

---

## Visual foundations

### Color
- **Primary brand** is a single deep green: `#1a6b4a`. Almost every brand moment is a **gradient** from that deep green into one of two brighter mints — `#228b5b` (utilitarian "filled button" pair) or `#2fa373` (the more saturated "hero" pair). The two gradients are interchangeable but consistent within a surface.
- **No dark mode.** It existed in earlier code; the product team removed it. Light only.
- **Background** is never pure white — it's a 4-stop diagonal gradient between four near-identical mint-tinted off-whites: `#f0f5f1 → #e8f0ea → #f2f6f0 → #edf5ef`. This subtle hue shift is what makes the glass cards on top feel like they're floating.
- **Surfaces** are **glass**: `rgba(255,255,255,0.6–0.85)` over `backdrop-filter: blur(10–24px) saturate(1.3)`, plus a 1px outline-variant border AND a 1px inner white highlight (`box-shadow: inset 0 0 0 1px rgba(255,255,255,0.5)`). That inset highlight is non-negotiable — it's what sells the "frosted" look.
- **Tonal "primary container"** is a soft mint `#adf2cc` / `rgba(26,107,74,0.08–0.14)` — used for tonal buttons, selection rings, badge backgrounds, AI-tool callouts.
- **Text neutrals** (light theme): `#191c1a` body → `#404943` secondary → `#5a6560` meta → `#707973` hint → `#8a9389` placeholder. Never pure black.
- **Semantic**: error red `#ba1a1a` over container `#ffdad6`; success folds into primary green; warn `#c46b00`.

### Type
- **Display & UI:** `Google Sans` (400 / 500 / 700) — used for `h1`, button labels, plan names, big numbers, eyebrows.
- **Body & inputs:** `Google Sans Text` (400 / 500) — paragraphs, hints, list items, captions.
- **Mono:** `Google Sans Mono` in the codebase, with `Roboto Mono` / `Fira Code` as substitutes — used for kbd shortcuts, code, model names.
- We follow the **MD3 type scale** but only really use a tight subset: 11px eyebrow, 12px hint, 13–14px body, 15–16px section title, 18–20px card heading, 24–32px display. Everything is left-aligned.
- Letter-spacing is +0.04em–+0.09em on uppercase eyebrows and badges; `-0.015em` on display headlines; default elsewhere.

> **Font substitution flag:** Google Sans is loaded over the network from Google Fonts; if you build offline, the closest local fallback chain `'Segoe UI', system-ui, sans-serif` is wired up. The product also ships `Google Sans Mono`, which Google Fonts does not currently expose publicly — `Roboto Mono` is the documented swap. Flag: ask LumiNote for the original `.ttf`s if pixel-perfect kerning matters.

### Spacing & layout
- 4-pt base scale (4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24 / 32 / 48). Inside cards the rhythm is almost always **gap: 14–24px**. Sections on the options page use **gap: 24px** and **padding: 24px**.
- Form fields are **40–48px tall**, **12–14px** horizontal padding, **12px** radius.
- The popup is a **fixed 400 × 600**. The options page caps at **680px max-width** centered. The plan-compare modal caps at **1040px** with a 3-column grid that collapses to 1 column under 720px.

### Backgrounds
- App: the 4-stop mint gradient (above).
- Cards: glass white over the app gradient.
- **No** photographs, no full-bleed imagery, no illustrations. The product is pure UI; surfaces are decorated with subtle radial mint blobs only on the welcome/onboarding deck.
- The mark bubble and Agent panel use the strong primary gradient as their fill — these are the only places a saturated brand surface appears in-product.

### Borders
- Outline variant `rgba(192,201,194,0.6)` at 1.5px is the default card/input border.
- Focused inputs adopt a **1.5px primary green** border and a **3px** primary-at-12% glow ring (`box-shadow: 0 0 0 3px rgba(26,107,74,0.12)`).
- Dividers inside cards are even softer: `rgba(238,244,239,0.7)`.

### Shadows / elevation
Three layers of "softness" stack on every meaningful element:
1. **Outer shadow** — small + diffuse (`0 2px 8px rgba(0,0,0,0.04)` for resting cards; `0 4–24px rgba(0,0,0,0.08–0.10)` for raised).
2. **Brand glow** for primary actions: `0 2–8px rgba(26,107,74,0.25–0.35)`.
3. **Inner highlight** — `inset 0 0 0 1px rgba(255,255,255,0.5)` on glass surfaces.

### Radius
Eight values, all on the same scale: `4 / 8 / 12 / 16 / 20 / 22 / 9999`. **Pills** (`9999`) are reserved for buttons, badges, billing toggles, kbd. **Cards** are 16–22px. **Inputs** are 12px. The mark bubble is a pill; the explain card is 20px; moodboard cards are 22px.

### Motion
- Standard easing `cubic-bezier(0.2, 0, 0, 1)` for most state changes (180–220ms).
- Emphasized `cubic-bezier(0.2, 0.9, 0.3, 1)` for entrances (modals, panel slide-ins, 250ms).
- Spring `cubic-bezier(0.3, 1.3, 0.4, 1)` for the modal's pop-in scale.
- **Buttons compress to `scale(0.97)` on `:active`**, lift `translateY(-1px)` on `:hover` for primary CTAs.
- Hover on tonal/ghost buttons darkens the background; never changes color hue.
- The welcome deck uses **CSS scroll-snap** for chapter pagination plus floating prev/next pill buttons.

### Hover / press states
- **Primary filled** — hover: deepens gradient to `#165c40 → #1e7a50`, lifts shadow. Press: `scale(0.97)`.
- **Tonal** — hover: container fill jumps from `0.08` → `0.14` alpha. No transform.
- **Ghost / outlined** — hover: gentle 8% mint background fills in, border darkens.
- **Icon buttons** — circular hover background `rgba(26,107,74,0.06)` → `0.14`.
- **Glass card** — hover: outer shadow grows; no scale, no lift. Selection adds a 2px primary ring.

### Transparency & blur
Used **everywhere** but with rules:
- `backdrop-filter: blur(10px)` for inline form chrome (sync card, kbd).
- `blur(16px) saturate(1.3)` for first-class cards (settings sections).
- `blur(24px) saturate(1.4)` reserved for floating overlays (mark bubble surrounds, explain card on busy pages).
- Modal overlay: `rgba(16,28,22,0.55)` with `blur(6px)`.

### Imagery vibe
There is essentially no in-product imagery. When the design system needs to imply "captured content" (e.g. a moodboard card), it shows a 16:9 muted-green placeholder rectangle, not a photo. If a real screenshot or external image lands on the moodboard, it sits inside a 22px-radius glass frame with the same multi-layer shadow.

### Key motifs to repeat
- **Glass cards on a mint gradient.**
- **Green gradient pill buttons** that compress on press.
- **Tonal mint badges** for tiers and tags.
- **3-column plan grid** with a centered `Most popular` ribbon on Pro.
- **Inline kbd-style shortcut hints** with mono font.
- **Quota meter** = label row + segmented number + thin gradient progress.

---

## Iconography

LumiNote uses a **single, hand-rolled inline-SVG icon set** drawn directly in component HTML. There is no icon font, no Lucide/Heroicons import, and no PNG icons in the codebase.

**Style**
- 24×24 viewBox with **2px stroke**, `stroke-linecap="round"`, `stroke-linejoin="round"`, `fill: none`.
- Stroke color is `currentColor` so icons inherit text color (typical: primary green for headlined sections, neutral `#5a6560` for inline).
- A second size (18×18) appears in section titles; small chrome icons (search, sync, eye-toggle) are 14–16px at the same 2.5px stroke for crispness at small sizes.

**Family resemblance** — the set looks essentially identical to **Lucide** (formerly Feather): same geometry, same stroke weight, same rounded ends. If you need an icon that LumiNote doesn't already define, **substitute from Lucide CDN** (`https://unpkg.com/lucide-static@latest/icons/<name>.svg`) and the visual fit will be perfect. Flag: any addition is a substitution, not original.

**Logos**
- **Primary mark** is the three-layer book/stack glyph (also used as the manifest icon at 16/48/128). See `assets/logo-stack.svg`.
- **Welcome / hero** logo variant is a green diamond with a white check inside — `assets/logo-diamond-check.svg`.
- The brand sets the logo on a **green tile** (the same `#1a6b4a` solid) in app-icon contexts; everywhere else the glyph appears in primary-green stroke on the surface color.

**Emoji** — never used.

**Unicode glyphs as icons** — minimal: `·` separators in meta, `←` / `→` arrows in flows, `+` for add. Real arrows and chevrons use SVG, not Unicode `‹›`.

**Provider color logos** appear in the settings → Sign in flow (Google's 4-color "G", etc). These are imported as their official multi-color SVGs and live inside neutral white pill buttons.

---

## Pointers

- Token reference → `colors_and_type.css`
- Component recreations → `ui_kits/<surface>/index.html`
- Quick visual catalog → open the Design System tab in the project (every card in `preview/` is registered)
- Reusable for Claude Code → `SKILL.md`
