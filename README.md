# Toolbox

**English** | [Русский](README.ru.md)

An Obsidian plugin that renames the images embedded in a note after the note itself.

> **A personal tool.** This plugin exists to support my own work on various projects, and its behaviour is shaped entirely by how I structure my notes for those projects. It is not intended to be a general-purpose Obsidian plugin, and there are no plans to submit it to the community catalogue. You are welcome to use it if your notes happen to follow the same conventions, but nothing here is designed with anyone else's workflow in mind.

## What it does

The plugin adds two commands — one for the note that is open right now, one for whole folders — and can run the second one for you when the vault is opened.

## Rename images in current note

It renames every image embedded in the note after the note itself, numbering the images in the order they first appear:

```text
{note name} {number}.{extension}
```

A note that names a single image after itself needs no numbering to tell its images apart, so that one image is simply:

```text
{note name}.{extension}
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
- A note with a single image to name gives it its own name, without a number — `Test.png`, not `Test 1.png`. As soon as a second image joins the note, both are numbered again.
- The extension of the image is kept as it is, including its case. Recognised extensions are `png`, `jpg`, `jpeg`, `gif`, `webp`, `bmp`, `svg` and `avif`, compared case-insensitively.
- Images stay in the folder they are in; only the file name changes.
- An image used several times in the note is renamed once, takes the number of its first appearance, and does not widen the numbering.
- Both `![[Image.png]]` and `![](Image.png)` are understood, in any folder, and the alias, the size (`![[Image.png|300]]`) and the title of a link are left untouched.
- Links inside YAML frontmatter, fenced code blocks and inline code are ignored, as are external addresses and embeds of files that are not images.
- An image another note links to as well is left alone: it belongs to no single note, so renaming it after this one would only take it away from the others. Such an image takes no number either, and the notice says how many were left out.
- Links that do not resolve to a file are skipped: they take no number, and the notice says how many were left out.
- An image that already has the right name for its position is left alone, and so is its link.

The renaming is planned in full before anything happens. If a name the plan needs is already taken by a file outside the note, nothing is renamed at all and a notice names both the image that wanted the name and the name it could not take — usually a leftover file that sits in the folder without being embedded anywhere. Every image is renamed straight to its new name as soon as that name is free. Images that take names from each other — a note where `Test 10.png` has to become `Test 05.png` while another image becomes `Test 10.png` — would each wait for the other, so one of them is moved to a temporary name to open the ring and the rest follows it. No file is ever overwritten, and an image whose name is free is renamed once, not twice. When a rename fails halfway through, the ones that already happened are taken back.

Renaming goes through the Obsidian file manager, so it honours the **Automatically update internal links** setting: when it is on, Obsidian rewrites the links itself and the plugin only checks the result; when it is off, the plugin rewrites the links of the current note in one undoable step. Links to the images from *other* notes are Obsidian's business either way.

## Rename images in image folders

The same renaming, applied to every note of the **image folders** named in the settings, one note after the other. Notes that are open are rewritten through the editor, so the change stays undoable; the rest are written straight to disk.

A single notice sums the run up — how many images were renamed in how many notes — and names every note that had to be left alone, with the reason.

## Renaming when the vault is opened

With **Rename images when the vault is opened** switched on, the run above happens once by itself: right after Obsidian has read the vault in, the notes of the image folders are gone through and whatever is out of place is put right. It reports only when it renamed something or ran into trouble.

That is the only run nobody asked for. The plugin does not listen to the vault: a note is never looked at while it is being written, and images never move under your hands. Everything else happens when a command is run.

## Debugging output

Everything the plugin does to the vault is written to the developer console (`Ctrl+Shift+I` → **Console**, filter by `[Toolbox]`): how many notes of the vault a run considered, every image rename, every image left alone because other notes use it — named one by one — and every note that is written back, with the number of links rewritten in it. Notes that could not be processed come out as warnings.

## Settings

| Setting | What it does |
| --- | --- |
| **Image folders** | The folders the two features above work on, subfolders included. Any number of them; each row picks a folder of the vault, and blank rows are ignored. The vault root cannot be given as a folder — a folder has to be named. |
| **Rename images when the vault is opened** | Whether the folders are gone through once at startup. Switching it on changes nothing right away — it takes effect the next time the vault is opened. To go through the folders now, run the command. |

Folders are matched without regard to case, and a folder holds everything below it, so `Projects` covers `Projects/2026/Trip.md` as well.

## Usage

Open a note, then run **Rename images in current note** from the command palette (`Ctrl/Cmd+P`). To go through the image folders instead, run **Rename images in image folders**. Both work only when they are run; nothing is renamed while a note is being edited.

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

## Deploying to a vault

The vault lives in a `.env` file of your own, which is not in the repository. Copy the example and put your path in it:

```bash
cp .env.example .env
```

```ini
OBSIDIAN_VAULT=D:\Me\Vault
```

Then build and copy the plugin into that vault in one step:

```bash
npm run deploy
```

It writes `main.js`, `manifest.json` and `styles.css` to `<vault>/.obsidian/plugins/toolbox/`, creating the folder if it is not there. A different vault can be given for a single run — as the first argument (`node scripts/deploy.mjs "C:\Path\To\Vault"`) or in an `OBSIDIAN_VAULT` environment variable, both of which win over `.env`. A folder without `.obsidian` inside is refused, nothing is copied when `main.js` has not been built yet, and a missing `.env` is reported rather than guessed around.

In VS Code the same thing runs from the command palette (`Ctrl+Shift+P`) → **Tasks: Run Task**:

- **Deploy plugin to Obsidian vault** — builds, then copies;
- **Copy plugin to Obsidian vault (no build)** — copies whatever `main.js` is there right now, handy next to `npm run dev`.

Both are defined in [.vscode/tasks.json](.vscode/tasks.json) and can be given a keyboard shortcut of their own through **Preferences: Open Keyboard Shortcuts (JSON)**:

```json
{
	"key": "ctrl+alt+d",
	"command": "workbench.action.tasks.runTask",
	"args": "Deploy plugin to Obsidian vault"
}
```

After the first deployment, restart Obsidian (or reload the app) and enable **Toolbox** in **Settings → Community plugins**; after later ones, reloading the plugin is enough.

Alternatively, to develop against a live vault without copying anything, clone this repository straight into `<your vault>/.obsidian/plugins/toolbox/`, run `npm run dev`, and reload the plugin after each change.

## Project layout

| Path | Purpose |
| --- | --- |
| [src/main.ts](src/main.ts) | Plugin and command registration |
| [src/markdown/lines.ts](src/markdown/lines.ts) | Markdown analysis: lines, frontmatter, fenced code blocks |
| [src/markdown/edits.ts](src/markdown/edits.ts) | Text edits and how to apply them to a string |
| [src/images/links.ts](src/images/links.ts) | Finding and reading embedded image links |
| [src/images/paths.ts](src/images/paths.ts) | Vault path arithmetic |
| [src/images/plan.ts](src/images/plan.ts) | New names, name conflicts and the resulting link edits |
| [src/images/rename.ts](src/images/rename.ts) | Carrying out a renaming safely, and its outcome |
| [src/images/folders.ts](src/images/folders.ts) | Running over the notes of the image folders |
| [src/log.ts](src/log.ts) | Debugging output |
| [src/images/vault-host.ts](src/images/vault-host.ts) | Binding the renaming to the vault, to the open note and to the file |
| [src/images/types.ts](src/images/types.ts) | Data types of the renaming |
| [src/settings/settings.ts](src/settings/settings.ts) | The stored settings, and which notes the folders hold |
| [src/settings/tab.ts](src/settings/tab.ts) | The settings tab in the Obsidian preferences |
| [src/settings/folder-suggest.ts](src/settings/folder-suggest.ts) | Suggesting vault folders while one is typed |
| [styles.css](styles.css) | The little styling the settings tab needs |
| [src/editor/apply-edits.ts](src/editor/apply-edits.ts) | Applying edits to the Obsidian editor as one transaction |
| [src/editor/position-mapping.ts](src/editor/position-mapping.ts) | Carrying cursors and selections across the edits |
| [scripts/deploy.mjs](scripts/deploy.mjs) | Copying the built plugin into a vault |
| [.env.example](.env.example) | Where the vault path goes, once copied to `.env` |
| [.vscode/tasks.json](.vscode/tasks.json) | VS Code tasks for deploying |
| [tests/](tests/) | Unit tests |

The feature is independent of the Obsidian API and carries the bulk of the test suite: the renaming reaches the vault only through the `ImageRenameHost` interface of [src/images/rename.ts](src/images/rename.ts), which [src/images/vault-host.ts](src/images/vault-host.ts) implements against Obsidian and the tests implement in memory.

## Credits

Scaffolded and reviewed with the help of the [obsidian-plugin-skill](https://github.com/gapmiss/obsidian-plugin-skill) for Claude.