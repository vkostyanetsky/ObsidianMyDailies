import type {
	App,
	SettingDefinitionGroup,
	SettingDefinitionItem,
	SettingGroupItem,
} from "obsidian";
import { PluginSettingTab } from "obsidian";

import type MyDailiesPlugin from "../main";
import { DEFAULT_MONTHLY_NOTE_NAME } from "../navigation/dashboard";
import { NAVIGATION_BLOCK } from "../navigation/block";
import { NUTRIENTS } from "../nutrition/totals";
import type { Nutrient } from "../nutrition/totals";
import {
	DEFAULT_NUTRITION_PROPERTIES,
	DEFAULT_OPEN_TASKS_PROPERTY,
	normalizeProperty,
	readSettingPath,
	writeSettingPath,
} from "./settings";

/**
 * Where in the settings of the plugin a control of this tab reads and writes.
 * The path is walked by `readSettingPath` and `writeSettingPath`, so a setting
 * is added by naming it here and nowhere else.
 */
type SettingKey =
	| "dailyNotes.folder"
	| "dailyNotes.autoUpdate"
	| "nutrition.enabled"
	| "nutrition.recordsFolder"
	| `nutrition.properties.${Nutrient}`
	| "openTasks.enabled"
	| "openTasks.property"
	| "navigation.monthlyNotesFolder"
	| "navigation.monthlyNoteName";

/** One row of a section, as Obsidian renders it from version 1.13 on. */
type SettingRow = SettingGroupItem<SettingKey>;

/** One section of the tab: a heading of its own with the rows underneath it. */
type SettingSection = SettingDefinitionGroup<SettingKey>;

/** How each nutrient is named in the settings. */
const NUTRIENT_NAMES: Record<Nutrient, string> = {
	calories: "Calories",
	protein: "Protein",
	fat: "Fat",
	carbs: "Carbohydrates",
	water: "Water",
};

/** What a row that names a property of the daily note says under its name. */
const PROPERTY_DESCRIPTION = "Property of the daily note the total is written to.";

/** The setting a nutrient is written to, by nutrient. */
function nutrientKey(nutrient: Nutrient): SettingKey {
	return `nutrition.properties.${nutrient}`;
}

/**
 * The default each setting that names a property or a note falls back on. Those
 * cannot be left saying nothing, or a run would write to a nameless property.
 */
const FALLBACKS: ReadonlyMap<string, string> = new Map<SettingKey, string>([
	["openTasks.property", DEFAULT_OPEN_TASKS_PROPERTY],
	["navigation.monthlyNoteName", DEFAULT_MONTHLY_NOTE_NAME],
	...NUTRIENTS.map((nutrient): [SettingKey, string] => [
		nutrientKey(nutrient),
		DEFAULT_NUTRITION_PROPERTIES[nutrient],
	]),
]);

/** A section of the tab, set apart by a heading Obsidian renders itself. */
function section(name: string, rows: SettingRow[]): SettingSection {
	return { type: "group", heading: name, items: rows };
}

/** The switch a metric is turned on and off by, with what it does under it. */
function metricSwitch(name: string, key: SettingKey, description: string): SettingRow {
	return {
		name,
		desc: description,
		control: { type: "toggle", key },
	};
}

/** One folder of the vault, picked by hand or from the suggestions. */
function folder(name: string, description: string, key: SettingKey): SettingRow {
	return {
		name,
		desc: description,
		control: { type: "folder", key, placeholder: "Folder in the vault" },
	};
}

/** A line of text that falls back to a default when it is left empty. */
function text(name: string, key: SettingKey, fallback: string, description?: string): SettingRow {
	return {
		name,
		desc: description,
		control: { type: "text", key, placeholder: fallback, defaultValue: fallback },
	};
}

/** What everything below stands on: where the notes are, and when they are read. */
function generalSection(): SettingSection {
	return section("General", [
		folder(
			"Daily notes folder",
			"Folder the notes that stand for a day are kept in. Left empty, the folder of " +
				"the core Daily notes plugin is used. Only the notes named after a day, " +
				"such as 2026-08-28, are ever written to.",
			"dailyNotes.folder",
		),
		folder(
			"Monthly notes folder",
			"Folder the notes that stand for a month are kept in. Left empty, they are " +
				"looked for in the vault root.",
			"navigation.monthlyNotesFolder",
		),
		text(
			"Monthly note name",
			"navigation.monthlyNoteName",
			DEFAULT_MONTHLY_NOTE_NAME,
			"How a monthly note is named, which is how the `" +
				NAVIGATION_BLOCK +
				"` block of a daily note finds the month to link to. What stands in curly " +
				"braces is the month itself, written the way Moment.js writes a date: " +
				"`Month {YYYY-MM}` names the note `Month 2026-08`, and `{MMMM YYYY}` " +
				"names it `August 2026`.",
		),
		{
			name: "Recalculate when the vault is opened",
			desc:
				"Go through every daily note once, right after the vault has been read in, " +
				"and work out the metrics of the sections below for it. Nothing is watched " +
				"afterwards; to work the values out at any other moment, run one of the two " +
				"commands. A note is only ever written when one of its values would come " +
				"out different from what it already says.",
			// Switching this on never starts a run of its own: every daily note is
			// worked out when the vault is opened the next time, or when the
			// command is run.
			control: { type: "toggle", key: "dailyNotes.autoUpdate" },
		},
	]);
}

/** The nutrition metric: its records folder and its properties. */
function nutritionSection(): SettingSection {
	return section("Nutrition", [
		metricSwitch(
			"Count nutrition",
			"nutrition.enabled",
			"Adds up what the eating records of a day state and writes the totals into " +
				"the daily note of that day.",
		),
		folder(
			"Nutrition records folder",
			"Folder the eating records are kept in, subfolders included. Every note in it " +
				"that carries a day, a product link and an amount is counted.",
			"nutrition.recordsFolder",
		),
		...NUTRIENTS.map((nutrient) =>
			text(
				NUTRIENT_NAMES[nutrient],
				nutrientKey(nutrient),
				DEFAULT_NUTRITION_PROPERTIES[nutrient],
				PROPERTY_DESCRIPTION,
			),
		),
	]);
}

/** The open tasks metric: a single property to count into. */
function tasksSection(): SettingSection {
	return section("Tasks", [
		metricSwitch(
			"Count open tasks",
			"openTasks.enabled",
			"Counts the tasks of a daily note that are still open — the lines starting " +
				"with `- [ ] ` — and writes the number into the note itself.",
		),
		text(
			"Open tasks",
			"openTasks.property",
			DEFAULT_OPEN_TASKS_PROPERTY,
			PROPERTY_DESCRIPTION,
		),
	]);
}

/**
 * The settings of the plugin, as they are shown in the Obsidian preferences.
 * The rows are described rather than built, so that Obsidian renders them
 * itself and finds them by its own settings search.
 */
export class MyDailiesSettingTab extends PluginSettingTab {
	private readonly plugin: MyDailiesPlugin;

	constructor(app: App, plugin: MyDailiesPlugin) {
		super(app, plugin);

		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
		return [generalSection(), nutritionSection(), tasksSection()];
	}

	getControlValue(key: string): unknown {
		return readSettingPath(this.plugin.settings, key);
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const fallback = FALLBACKS.get(key);

		// A setting that says nothing would leave the plugin with nothing to go
		// by, so the default steps in until something is typed again.
		const stored =
			fallback !== undefined && typeof value === "string"
				? normalizeProperty(value, fallback)
				: value;

		writeSettingPath(this.plugin.settings, key, stored);

		await this.plugin.saveSettings();
	}
}
