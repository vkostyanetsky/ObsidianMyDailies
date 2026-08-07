# Yoin Toolkit

An Obsidian plugin that renumbers section and frame headings in the active note.

## What it does

The plugin adds one command:

**Renumber frames in current note**

It rewrites the numbers in level two and level three headings of the note that is currently open:

- `##` — sections, numbered sequentially across the whole note;
- `###` — frames, numbered sequentially inside their section.

Before:

```markdown
## 02 BEE

### 🎞️ 1

some text

### 🎞️ 08

other text

## 04 BUMBLE

### 🎞️ 05

more text

### 🎞️ 11

even more text
```

After:

```markdown
## 01 BEE

### 🎞️ 01

some text

### 🎞️ 02

other text

## 02 BUMBLE

### 🎞️ 01

more text

### 🎞️ 02

even more text
```

## Rules

- Section (`##`) numbers start at `01` and run through the whole note.
- Frame (`###`) numbers start at `01` and restart on every new numbered section.
- Numbers are always written with at least two digits (`01`, `09`, `10`), and numbers above `99` keep all their digits (`100`, `101`).
- Only the **first** integer of a heading is replaced. Everything else — emoji, case, spacing, punctuation, any further numbers — is preserved: `### 🎞️ 8 — version 2026` becomes `### 🎞️ 01 — version 2026`.
- A heading without a number is left alone and does not consume a number, so `### 🎞️ 05` / `### Introduction` / `### 🎞️ 20` becomes `### 🎞️ 01` / `### Introduction` / `### 🎞️ 02`.
- A `##` heading without a number is not treated as a section: it neither takes a number nor restarts frame numbering.
- `###` headings that appear before the first numbered `##` heading are left unchanged.
- Headings inside fenced code blocks (both ` ``` ` and `~~~`, of any length) are ignored.
- Headings inside YAML frontmatter are ignored. A `---` line in the body of the note is not frontmatter.
- Headings of other levels (`#`, `####`, …) are ignored, as is anything that only looks like a heading.

The command is idempotent: running it on an already renumbered note changes nothing.

Everything is applied as one editor transaction, so a single **Undo** reverts the whole renumbering. Line breaks, the final newline, and the rest of the note's content are never touched. If the note is already numbered correctly, nothing is written at all.

When no Markdown note is open, the command shows a `No active Markdown note.` notice and makes no changes.

## Usage

Open a note, then run **Renumber frames in current note** from the command palette (`Ctrl/Cmd+P`).

## Building

Requires Node.js 18 or newer.

```bash
npm install
```

Production build — type-checks and writes `main.js`:

```bash
npm run build
```

Development build with rebuild-on-change:

```bash
npm run dev
```

Unit tests:

```bash
npm test
```

## Installing manually

1. Run `npm install && npm run build`.
2. Create the folder `<your vault>/.obsidian/plugins/yoin-toolkit/`.
3. Copy `main.js` and `manifest.json` into it.
4. Restart Obsidian (or reload the app), then enable **Yoin Toolkit** in **Settings → Community plugins**.

To develop against a live vault, clone this repository straight into `<your vault>/.obsidian/plugins/yoin-toolkit/`, run `npm run dev`, and reload the plugin after each change.

## Project layout

| Path | Purpose |
| --- | --- |
| [src/main.ts](src/main.ts) | Plugin and command registration |
| [src/renumber/scanner.ts](src/renumber/scanner.ts) | Markdown analysis: lines, frontmatter, fenced code blocks, headings |
| [src/renumber/edits.ts](src/renumber/edits.ts) | Numbering rules and the resulting text edits |
| [src/renumber/types.ts](src/renumber/types.ts) | Shared data types |
| [src/editor/apply-edits.ts](src/editor/apply-edits.ts) | Applying edits to the Obsidian editor as one transaction |
| [src/editor/position-mapping.ts](src/editor/position-mapping.ts) | Carrying cursors and selections across the edits |
| [tests/](tests/) | Unit tests |

The numbering logic is independent of the Obsidian API. `renumberFrames(source: string): string` and `collectRenumberEdits(source: string): TextEdit[]` in [src/renumber/edits.ts](src/renumber/edits.ts) are pure functions and carry the bulk of the test suite.

## Credits

Scaffolded and reviewed with the help of the [obsidian-plugin-skill](https://github.com/gapmiss/obsidian-plugin-skill) for Claude.