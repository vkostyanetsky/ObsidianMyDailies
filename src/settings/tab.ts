import type { App } from "obsidian";
import { PluginSettingTab, Setting } from "obsidian";

import type MyDailiesPlugin from "../main";
import { DEFAULT_MONTHLY_NOTE_NAME } from "../navigation/dashboard";
import { NAVIGATION_BLOCK } from "../navigation/block";
import { NUTRIENTS } from "../nutrition/totals";
import type { Nutrient } from "../nutrition/totals";
import {
	DEFAULT_NUTRITION_PROPERTIES,
	DEFAULT_OPEN_TASKS_PROPERTY,
	normalizeProperty,
} from "./settings";
import { FolderSuggest } from "./folder-suggest";

/** How each nutrient is named in the settings. */
const NUTRIENT_NAMES: Record<Nutrient, string> = {
	calories: "Calories",
	protein: "Protein",
	fat: "Fat",
	carbs: "Carbohydrates",
	water: "Water",
};

/** What a switch of a metric says under its name. */
const METRIC_SWITCH_DESCRIPTION = "Whether this is worked out for a daily note at all.";

/** The settings of the plugin, as they are shown in the Obsidian preferences. */
export class MyDailiesSettingTab extends PluginSettingTab {
	private readonly plugin: MyDailiesPlugin;

	constructor(app: App, plugin: MyDailiesPlugin) {
		super(app, plugin);

		this.plugin = plugin;
	}

	display(): void {
		this.containerEl.empty();

		this.displayDailyNotes();
		this.displayNutrition();
		this.displayTasks();
		this.displayNavigation();
	}

	/** What every metric of a daily note shares: where they are, and when. */
	private displayDailyNotes(): void {
		new Setting(this.containerEl)
			.setName("Daily notes")
			.setDesc(
				"Where the notes that stand for a day are kept, and when the metrics below " +
					"are worked out for them. A note is only ever written when one of its " +
					"values would come out different from what it already says.",
			)
			.setHeading();

		this.displayFolder(
			"Daily notes folder",
			"Left empty, the folder of the core Daily notes plugin is used. Only the notes " +
				"named after a day, such as 2026-08-28, are ever written to.",
			() => this.plugin.settings.dailyNotes.folder,
			(value) => {
				this.plugin.settings.dailyNotes.folder = value;
			},
		);

		new Setting(this.containerEl)
			.setName("Recalculate when the vault is opened")
			.setDesc(
				"Go through every daily note once, right after the vault has been read in. " +
					"Nothing is watched afterwards; to work the values out at any other " +
					"moment, run one of the two commands.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.dailyNotes.autoUpdate)
					.onChange(async (value) => {
						this.plugin.settings.dailyNotes.autoUpdate = value;

						// Switching this on never starts a run of its own: every
						// daily note is worked out when the vault is opened the
						// next time, or when the command is run.
						await this.plugin.saveSettings();
					}),
			);
	}

	/** The nutrition metric: its records folder and its properties. */
	private displayNutrition(): void {
		new Setting(this.containerEl)
			.setName("Nutrition")
			.setDesc(
				"Adds up what the eating records of a day state and writes the totals into " +
					"the daily note of that day.",
			)
			.setHeading();

		this.displaySwitch(
			"Count nutrition",
			METRIC_SWITCH_DESCRIPTION,
			() => this.plugin.settings.nutrition.enabled,
			(value) => {
				this.plugin.settings.nutrition.enabled = value;
			},
		);

		this.displayFolder(
			"Nutrition records folder",
			"Folder the eating records are kept in, subfolders included. Every note in it " +
				"that carries a day, a product link and an amount is counted.",
			() => this.plugin.settings.nutrition.recordsFolder,
			(value) => {
				this.plugin.settings.nutrition.recordsFolder = value;
			},
		);

		for (const nutrient of NUTRIENTS) {
			this.displayProperty(
				NUTRIENT_NAMES[nutrient],
				DEFAULT_NUTRITION_PROPERTIES[nutrient],
				() => this.plugin.settings.nutrition.properties[nutrient],
				(value) => {
					this.plugin.settings.nutrition.properties[nutrient] = value;
				},
			);
		}
	}

	/** The open tasks metric: a single property to count into. */
	private displayTasks(): void {
		new Setting(this.containerEl)
			.setName("Tasks")
			.setDesc(
				"Counts the tasks of a daily note that are still open — the lines starting " +
					"with `- [ ] ` — and writes the number into the note itself.",
			)
			.setHeading();

		this.displaySwitch(
			"Count open tasks",
			METRIC_SWITCH_DESCRIPTION,
			() => this.plugin.settings.openTasks.enabled,
			(value) => {
				this.plugin.settings.openTasks.enabled = value;
			},
		);

		this.displayProperty(
			"Open tasks",
			DEFAULT_OPEN_TASKS_PROPERTY,
			() => this.plugin.settings.openTasks.property,
			(value) => {
				this.plugin.settings.openTasks.property = value;
			},
		);
	}

	/** The navigation block: where the notes it links to are, and how named. */
	private displayNavigation(): void {
		new Setting(this.containerEl)
			.setName("Navigation")
			.setDesc(
				`A daily note carrying a \`${NAVIGATION_BLOCK}\` code block shows the day ` +
					"before it and the day after it, together with the month it belongs to " +
					"and the months on either side of that one. The days are looked for in " +
					"the daily notes folder above, the months in the folder below. Whatever " +
					"is written inside the block is shown underneath, and the note itself is " +
					"never written to.",
			)
			.setHeading();

		this.displayFolder(
			"Monthly notes folder",
			"Folder the notes that stand for a month are kept in. Left empty, they are " +
				"looked for in the vault root.",
			() => this.plugin.settings.navigation.monthlyNotesFolder,
			(value) => {
				this.plugin.settings.navigation.monthlyNotesFolder = value;
			},
		);

		this.displayText(
			"Monthly note name",
			"How a monthly note is named. What stands in curly braces is the month itself, " +
				"written the way Moment.js writes a date: `Month {YYYY-MM}` names the note " +
				"`Month 2026-08`, and `{MMMM YYYY}` names it `August 2026`.",
			DEFAULT_MONTHLY_NOTE_NAME,
			() => this.plugin.settings.navigation.monthlyNoteName,
			(value) => {
				this.plugin.settings.navigation.monthlyNoteName = value;
			},
		);
	}

	/** The switch a metric is turned on and off by. */
	private displaySwitch(
		name: string,
		description: string,
		read: () => boolean,
		write: (value: boolean) => void,
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(description)
			.addToggle((toggle) =>
				toggle.setValue(read()).onChange(async (value) => {
					write(value);
					await this.plugin.saveSettings();
				}),
			);
	}

	/** One folder of the vault, picked by hand or from the suggestions. */
	private displayFolder(
		name: string,
		description: string,
		read: () => string,
		write: (value: string) => void,
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(description)
			.addSearch((search) => {
				const save = async (value: string): Promise<void> => {
					write(value);
					await this.plugin.saveSettings();
				};

				search.inputEl.setAttribute("aria-label", name);
				search
					.setPlaceholder("Folder in the vault")
					.setValue(read())
					.onChange((value) => {
						void save(value);
					});

				new FolderSuggest(this.app, search.inputEl, (path) => {
					void save(path);
				});
			});
	}

	/** The property one value of a metric ends up in. */
	private displayProperty(
		name: string,
		fallback: string,
		read: () => string,
		write: (value: string) => void,
	): void {
		this.displayText(name, null, fallback, read, write);
	}

	/** A line of text that falls back to a default when it is left empty. */
	private displayText(
		name: string,
		description: string | null,
		fallback: string,
		read: () => string,
		write: (value: string) => void,
	): void {
		const setting = new Setting(this.containerEl).setName(name);

		if (description !== null) {
			setting.setDesc(description);
		}

		setting.addText((text) =>
			text
				.setPlaceholder(fallback)
				.setValue(read())
				.onChange(async (value) => {
					// A setting that says nothing would leave the plugin with
					// nothing to go by, so the default steps in until something is
					// typed again.
					write(normalizeProperty(value, fallback));
					await this.plugin.saveSettings();
				}),
		);
	}
}
