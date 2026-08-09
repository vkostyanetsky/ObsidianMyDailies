# Toolbox

An Obsidian plugin that renumbers section and frame headings in the active note and renames the images embedded in it.

> **A personal tool.** This plugin exists to support my own work on various projects, and its behaviour is shaped entirely by how I structure my notes for those projects. It is not intended to be a general-purpose Obsidian plugin, and there are no plans to submit it to the community catalogue. You are welcome to use it if your notes happen to follow the same conventions, but nothing here is designed with anyone else's workflow in mind.

## What it does

The plugin adds two commands, both of which work on the note that is open right now.

## Renumber frames in current note

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

### Rules

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

## Rename images in current note

It renames every image embedded in the note after the note itself, numbering the images in the order they first appear:

```text
{note name} {number}.{extension}
```

Before:

```markdown
![[Test 1.png]]

![[Pasted image 20260808172735.png]]

![[Test 10.png]]
```

After (with eleven images in the note):

```markdown
![[Test 01.png]]

![[Test 03.png]]

![[Test 05.png]]
```

### Rules

- Numbers start at `1` and are padded to the width of the total: `1`…`9` for up to nine images, `01`…`99` for up to ninety-nine, `001`…`999` beyond that.
- The extension of the image is kept as it is, including its case. Recognised extensions are `png`, `jpg`, `jpeg`, `gif`, `webp`, `bmp`, `svg` and `avif`, compared case-insensitively.
- Images stay in the folder they are in; only the file name changes.
- An image used several times in the note is renamed once, takes the number of its first appearance, and does not widen the numbering.
- Both `![[Image.png]]` and `![](Image.png)` are understood, in any folder, and the alias, the size (`![[Image.png|300]]`) and the title of a link are left untouched.
- Links inside YAML frontmatter, fenced code blocks and inline code are ignored, as are external addresses and embeds of files that are not images.
- Links that do not resolve to a file are skipped: they take no number, and the notice says how many were left out.
- An image that already has the right name for its position is left alone, and so is its link.

The renaming is planned in full before anything happens. If a name the plan needs is already taken by a file outside the note, nothing is renamed at all and a notice names the file. Images that take names from each other — a note where `Test 10.png` has to become `Test 05.png` while another image becomes `Test 10.png` — are handled by moving every image to a temporary name first, so no file is ever overwritten. When a rename fails halfway through, the ones that already happened are taken back.

Renaming goes through the Obsidian file manager, so it honours the **Automatically update internal links** setting: when it is on, Obsidian rewrites the links itself and the plugin only checks the result; when it is off, the plugin rewrites the links of the current note in one undoable step. Links to the images from *other* notes are Obsidian's business either way.

## Usage

Open a note, then run **Renumber frames in current note** or **Rename images in current note** from the command palette (`Ctrl/Cmd+P`).

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
2. Create the folder `<your vault>/.obsidian/plugins/toolbox/`.
3. Copy `main.js` and `manifest.json` into it.
4. Restart Obsidian (or reload the app), then enable **Toolbox** in **Settings → Community plugins**.

To develop against a live vault, clone this repository straight into `<your vault>/.obsidian/plugins/toolbox/`, run `npm run dev`, and reload the plugin after each change.

## Project layout

| Path | Purpose |
| --- | --- |
| [src/main.ts](src/main.ts) | Plugin and command registration |
| [src/markdown/lines.ts](src/markdown/lines.ts) | Markdown analysis: lines, frontmatter, fenced code blocks |
| [src/markdown/edits.ts](src/markdown/edits.ts) | Text edits and how to apply them to a string |
| [src/renumber/scanner.ts](src/renumber/scanner.ts) | Finding section and frame headings |
| [src/renumber/edits.ts](src/renumber/edits.ts) | Numbering rules and the resulting text edits |
| [src/renumber/types.ts](src/renumber/types.ts) | Data types of the renumbering |
| [src/images/links.ts](src/images/links.ts) | Finding and reading embedded image links |
| [src/images/paths.ts](src/images/paths.ts) | Vault path arithmetic |
| [src/images/plan.ts](src/images/plan.ts) | New names, name conflicts and the resulting link edits |
| [src/images/rename.ts](src/images/rename.ts) | Carrying out a renaming safely, and its outcome |
| [src/images/vault-host.ts](src/images/vault-host.ts) | Binding the renaming to the vault and the open note |
| [src/images/types.ts](src/images/types.ts) | Data types of the renaming |
| [src/editor/apply-edits.ts](src/editor/apply-edits.ts) | Applying edits to the Obsidian editor as one transaction |
| [src/editor/position-mapping.ts](src/editor/position-mapping.ts) | Carrying cursors and selections across the edits |
| [tests/](tests/) | Unit tests |

Both features are independent of the Obsidian API and carry the bulk of the test suite. `renumberFrames(source: string): string` and `collectRenumberEdits(source: string): TextEdit[]` in [src/renumber/edits.ts](src/renumber/edits.ts) are pure functions; the renaming reaches the vault only through the `ImageRenameHost` interface of [src/images/rename.ts](src/images/rename.ts), which [src/images/vault-host.ts](src/images/vault-host.ts) implements against Obsidian and the tests implement in memory.

## Credits

Scaffolded and reviewed with the help of the [obsidian-plugin-skill](https://github.com/gapmiss/obsidian-plugin-skill) for Claude.