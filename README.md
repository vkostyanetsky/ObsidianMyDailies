# My Dailies 🧰 📅 ✅

An Obsidian plugin holding the odds and ends my own vault needs: working out the numbers a daily note carries — what was eaten that day, how many tasks are still open — pointing from a day to the days and the months around it, and filling a month with the notes of its days.

> **A personal tool.** This plugin exists to make my day-to-day work easier, and its behaviour is shaped entirely by how I structure my notes. It is not intended to be a general-purpose Obsidian plugin, and there are no plans to submit it to the community catalogue. You are welcome to use it if your notes happen to follow the same conventions, but nothing here is designed with anyone else's workflow in mind.

## ✨ What it does

Three features, three commands, and one run the plugin can make by itself once the vault is opened:

| Feature | How it is asked for |
| --- | --- |
| [Daily notes](#-daily-notes) | **Recalculate properties of current daily note**, **Recalculate properties of all daily notes** |
| [Monthly notes](#-monthly-notes) | **Create daily notes for the current monthly note** |
| [Navigation](#-navigation) | A `my-dailies-daily-note-navigation` block written into a daily note, a `my-dailies-monthly-note-navigation` block written into a monthly one |

## 📅 Daily notes

The plugin works out a handful of numbers for a day and writes them into the properties of the daily note that stands for it. Each kind of number is a **metric**, switched on and named in the settings on its own:

| Metric | What it counts |
| --- | --- |
| [Nutrition](#-nutrition) | Calories, protein, fat, carbohydrates and water eaten that day |
| [Open tasks](#-open-tasks) | Tasks of the note that are still to be done |

A daily note is a note of the **daily notes folder** named after a day — `2026-08-28` and the like. Everything else in that folder, an attachment or a drawing named after the day it was made on, is left alone.

### What is written

Every metric that is switched on is asked about the note, and their properties are written together, in one go:

```yaml
---
weight:
steps:
gym:
timestamp: 1755706724
calories: 1387
protein: 72
fat: 57
carbs: 143
water: 1600
tasks: 3
---
```

Only those lines are touched. A property that is already there keeps its place, one that is missing is appended to the block, and everything else — order, spacing, quoting, the properties the plugin knows nothing about — is left byte for byte as it was.

**A number that comes out as zero is written as nothing at all.** A day nothing was eaten on and a note with no open task left get the property, empty:

```yaml
---
calories:
tasks:
---
```

A zero would read like a day that was counted and came to nothing, which is rarely what it means, and an empty property is what the rest of the vault treats as no value.

**A note is only written when a value would come out different from what it already says.** A run over a vault of a thousand days that changed nothing writes nothing, and leaves a thousand modification dates alone. It is also why the metrics are all asked before anything is written: two metrics that each wrote for themselves would touch the same note twice.

For the same reason two metrics must not be pointed at the same property — they would overwrite each other on every run, and the note would never settle. A run that finds such a clash writes nothing at all and names the property.

### Recalculate properties of current daily note

Works out every switched-on metric for the note that is open and writes the lot. A notice reports what each of them came to.

The command is not offered at all unless the note in front of you stands for a day — today's or any other. On anything else it does not appear in the command palette, and a shortcut bound to it does nothing.

### Recalculate properties of all daily notes

The same, for every daily note of the vault. Each metric reads what it needs once, so a run does not walk the same records again for every note. A single notice sums it up: how many notes were written, out of how many.

### Recalculating when the vault is opened

With **Recalculate when the vault is opened** switched on, the run above happens once by itself, right after Obsidian has read the vault in. It reports only when it wrote something or ran into trouble. Nothing is watched afterwards: records and tasks can be edited all day without a daily note moving under your hands.

## 🍎 Nutrition

Adds up what the eating records of a day state: calories, protein, fat, carbohydrates and water.

### What is read

- **Records** — every note of the **nutrition records folder**, subfolders included. A record states the day it belongs to in `date`, links the product in `product` and states how much of it was eaten in `quantity`.
- **Products** — whatever note a record's `product` links to, wherever it sits. A product states `calories`, `protein`, `fat`, `carbs` and `water` for one `unit_size` of itself.

A record, and the product it links to:

```yaml
date: 2026-08-27                 calories: 120.3
product: "[[Пирог с рыбой]]"     protein: 10
quantity: 148                    fat: 4.5
                                 carbs: 10.2
                                 water: 0
                                 unit_size: 100
```

### How it is counted

Every record is worked out on its own and rounded, and the rounded amounts are added up afterwards:

```text
round(product.calories / product.unit_size * quantity)
```

Rounding per record and rounding the sum are not the same thing: two records of 12.5 kcal each come out as 26, not 25. The order above is the one to keep.

A record whose product links to no note is skipped and reported, as is one without an amount; the same goes for a nutrient a product does not state. A day nothing was eaten on leaves the properties empty.

## ✅ Open tasks

Counts the tasks of the daily note itself that are still to be done — the lines that start with `- [ ] `:

```text
- [ ] Write the morning stand-up        counted
- [x] Read the mail                     done
- [/] Draft the release notes           anything but a space is done
    - [ ] Ask about the event ids       nested under a task, not counted
```

Only the tasks flush left are counted, so the subtasks of a task do not inflate the number. A note with nothing left to do leaves the property empty rather than saying `0`.

The count comes from the index Obsidian keeps rather than from the text of the note. A run therefore reads no file at all, and a `- [ ] ` inside a fenced code block is not mistaken for a task, because Obsidian does not index it as one either.

## 🗓️ Monthly notes

A monthly note is a note of the **monthly notes folder** named after a month the way the **Monthly note name** setting writes one — the same note the navigation of a day links to. `Month {YYYY-MM}` makes `Month 2026-08` such a note, `{MMMM YYYY}` makes `August 2026` one.

### Create daily notes for the current monthly note

Gives every day of that month a daily note of its own, in the **daily notes folder**, and creates the folder if it is not there yet. A notice sums it up: how many of the days were given a note, out of how many.

- **The notes are empty.** Nothing is written into them — no properties, no navigation block; what a day is to carry is written by the metrics, or by hand.
- **A day that already has a note is left alone**, whatever that note says.
- The command is not offered unless the note in front of you stands for a month. Its name has to read exactly as the setting writes a month, so `Month 2026-08` is one and `Month 2026` is not.
- A day that could not be written does not stop the ones after it; the reason goes to the console.

## 🧭 Navigation

A note carrying a code block of its own shows where it sits among the notes around it: one block for a day, one for a month.

### The navigation of a daily note

````text
```my-dailies-daily-note-navigation
```
````

What comes out is the weekday the note stands for, the day before it and the day after it, and the month it belongs to together with the months on either side:

```text
> [!seealso] Saturday
> 📅 [[Days/2026-08-28|2026-08-28]] ← 2026-08-29 → [[Days/2026-08-30|2026-08-30]]

[[Months/Month 2026-07|JUL]] ⬅️ [[Months/Month 2026-08|AUG]] ➡️ [[Months/Month 2026-09|SEP]]
```

- The days are looked for in the **daily notes folder**, the same one the metrics use, and are named after the day itself, `2026-08-29`.
- Anything written inside the block is rendered below the navigation, as Markdown, quoted into the callout.
- A note that does not stand for a day, or does not sit in the daily notes folder, shows a warning instead — the block only ever means something in a daily note.

### The navigation of a monthly note

````text
```my-dailies-monthly-note-navigation
```
````

What comes out is the month the note stands for, written out in full, with the month before it and the month after it on either side:

```text
> [!seealso] September 2026
> [[Months/Month 2026-08|AUG]] ⬅️ SEP ➡️ [[Months/Month 2026-10|OCT]]
```

- **The month the note stands for is named, not linked.** The link would only lead back to the note the block is written in.
- Anything written inside the block is rendered below the months, as Markdown, quoted into the callout.
- A note that does not stand for a month, or does not sit in the monthly notes folder, shows a warning instead — the block only ever means something in a monthly note.

### Both of them

- The months are looked for in the **monthly notes folder** and named after the **Monthly note name** setting: what stands in curly braces is the month, written the way Moment.js writes a date. `Month {YYYY-MM}` names the note `Month 2026-08`, `{MMMM YYYY}` names it `August 2026`. The same setting tells a monthly note which month it stands for.
- The weekday, and the names of the months long and short, are written in the language Obsidian is set to.
- **Nothing is created and nothing is written.** A day or a month the vault has no note for is still linked, as the empty link Obsidian offers to fill in.

## 🐞 Debugging output

Everything the plugin does to the vault is written to the developer console (`Ctrl+Shift+I` → **Console**, filter by `[My Dailies]`): how many eating records were read and from where, every daily note whose properties are written, with the values that went into it, and every note and folder that is created. Notes that could not be processed come out as warnings.

## ⚙️ Settings

| Section | Setting | What it does |
| --- | --- | --- |
| **General** | **Daily notes folder** | The folder the daily notes are kept in. Left empty, the folder of the core **Daily notes** plugin is used. |
| **General** | **Monthly notes folder** | The folder the notes that stand for a month are kept in. Left empty, they are looked for in the vault root. |
| **General** | **Monthly note name** | How a monthly note is named, which is how the navigation blocks find the month to link to, and how a monthly note is read back as the month it stands for. The month itself stands in curly braces. Blank falls back to `Month {YYYY-MM}`. |
| **General** | **Recalculate when the vault is opened** | Whether every daily note is worked out once at startup. Switching it on changes nothing right away — it takes effect the next time the vault is opened. To go through the notes now, run the command. |
| **Nutrition** | **Count nutrition** | Whether what was eaten is counted for a daily note at all. |
| **Nutrition** | **Nutrition records folder** | The folder the eating records are kept in, subfolders included. Without it nothing is summed up, and the commands report as much. |
| **Nutrition** | **Calories**, **Protein**, **Fat**, **Carbohydrates**, **Water** | The properties of the daily note each total is written to. Blank falls back to `calories`, `protein`, `fat`, `carbs`, `water`. |
| **Tasks** | **Count open tasks** | Whether the open tasks of a daily note are counted at all. |
| **Tasks** | **Open tasks** | The property the number of open tasks is written to. Blank falls back to `tasks`. |

Folders are matched without regard to case, and a folder holds everything below it, so `Records` covers `Records/2026/Breakfast.md` as well.

## 🙂 Usage

Open a daily note and run **Recalculate properties of current daily note** from the command palette (`Ctrl/Cmd+P`) to write its numbers, or **Recalculate properties of all daily notes** to go through the whole vault. To carry the navigation as well, write a `my-dailies-daily-note-navigation` block into the note — a template of the daily notes is the place for it.

Open a monthly note and run **Create daily notes for the current monthly note** to give every day of that month an empty note, ready to be filled in. A `my-dailies-monthly-note-navigation` block written into that note points it at the months on either side.

All of them work only when they are run, and no note is written unless one of its values would come out different from what it already says — or, for a day of the month, unless it has no note at all.

## 🔨 Building

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

## 📦 Deploying to a vault

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

It writes `main.js` and `manifest.json` to `<vault>/.obsidian/plugins/my-dailies/`, creating the folder if it is not there. A different vault can be given for a single run — as the first argument (`node scripts/deploy.mjs "C:\Path\To\Vault"`) or in an `OBSIDIAN_VAULT` environment variable, both of which win over `.env`. A folder without `.obsidian` inside is refused, nothing is copied when `main.js` has not been built yet, and a missing `.env` is reported rather than guessed around.

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

After the first deployment, restart Obsidian (or reload the app) and enable **My Dailies** in **Settings → Community plugins**; after later ones, reloading the plugin is enough.

Alternatively, to develop against a live vault without copying anything, clone this repository straight into `<your vault>/.obsidian/plugins/my-dailies/`, run `npm run dev`, and reload the plugin after each change.

## 🗂️ Project layout

| Path | Purpose |
| --- | --- |
| [src/main.ts](src/main.ts) | Plugin and command registration |
| [src/markdown/lines.ts](src/markdown/lines.ts) | Markdown analysis: lines, frontmatter, fenced code blocks |
| [src/markdown/frontmatter.ts](src/markdown/frontmatter.ts) | Writing single properties without reformatting the rest |
| [src/daily-notes/notes.ts](src/daily-notes/notes.ts) | Telling a daily note apart from any other note |
| [src/daily-notes/metrics.ts](src/daily-notes/metrics.ts) | What a metric is, and the run that merges them into one write |
| [src/daily-notes/vault-host.ts](src/daily-notes/vault-host.ts) | Binding a run to the daily notes of the vault |
| [src/monthly-notes/days.ts](src/monthly-notes/days.ts) | Filling a month with the daily notes it has none for |
| [src/monthly-notes/vault-host.ts](src/monthly-notes/vault-host.ts) | Which note stands for a month, and how a day's note is created |
| [src/navigation/dates.ts](src/navigation/dates.ts) | The days and the months around a day, and the days of a month |
| [src/navigation/dashboard.ts](src/navigation/dashboard.ts) | The navigation of a note, as the Markdown it is rendered from |
| [src/navigation/block.ts](src/navigation/block.ts) | Binding the navigation block to the vault and to Moment |
| [src/nutrition/totals.ts](src/nutrition/totals.ts) | Reading the records and summing up a day |
| [src/nutrition/metric.ts](src/nutrition/metric.ts) | Nutrition as a metric: the records, the products, the totals |
| [src/tasks/open-tasks.ts](src/tasks/open-tasks.ts) | Which list items count as a task still to be done |
| [src/tasks/metric.ts](src/tasks/metric.ts) | Open tasks as a metric, off Obsidian's index |
| [src/settings/settings.ts](src/settings/settings.ts) | The stored settings, and which notes the folders hold |
| [src/settings/tab.ts](src/settings/tab.ts) | The settings tab in the Obsidian preferences |
| [src/settings/folder-suggest.ts](src/settings/folder-suggest.ts) | Suggesting vault folders while one is typed |
| [src/log.ts](src/log.ts) | Debugging output |
| [scripts/deploy.mjs](scripts/deploy.mjs) | Copying the built plugin into a vault |
| [.env.example](.env.example) | Where the vault path goes, once copied to `.env` |
| [.vscode/tasks.json](.vscode/tasks.json) | VS Code tasks for deploying |
| [tests/](tests/) | Unit tests |

The logic is independent of the Obsidian API and carries the bulk of the test suite. It reaches the vault only through an interface — `DailyNotesHost` in [src/daily-notes/metrics.ts](src/daily-notes/metrics.ts) — which [src/daily-notes/vault-host.ts](src/daily-notes/vault-host.ts) implements against Obsidian and the tests implement in memory.

A new metric of a daily note is a `DayMetricSource`: it declares the properties it owns, reads what it needs when the run opens it, and answers what those properties come to for a note — merging, comparing and writing are not its business. Adding one means a folder under `src/`, a line in `MyDailiesPlugin.metrics()`, and a section in the settings tab.

## 🙏 Credits

Scaffolded and reviewed with the help of the [obsidian-plugin-skill](https://github.com/gapmiss/obsidian-plugin-skill) for Claude.
