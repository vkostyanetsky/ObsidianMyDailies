import { DEFAULT_MONTHLY_NOTE_NAME } from "../navigation/dashboard";
import type { Nutrient } from "../nutrition/totals";
import { NUTRIENTS } from "../nutrition/totals";

/** The property each nutrient is written to, by nutrient. */
export type NutritionProperties = Record<Nutrient, string>;

/** What a run over the daily notes needs, whichever metrics take part in it. */
export interface DailyNotesSettings {
	/**
	 * Folder the daily notes are kept in. Left empty, the folder of the core
	 * Daily notes plugin is used.
	 */
	folder: string;
	/** Whether every daily note is worked out once when the vault is opened. */
	autoUpdate: boolean;
}

/** The navigation block: what it links a daily note to. */
export interface NavigationSettings {
	/**
	 * Folder the monthly notes are kept in, as the user typed it. Left empty,
	 * the monthly notes are looked for in the vault root.
	 */
	monthlyNotesFolder: string;
	/**
	 * How a monthly note is named, with the month itself in curly braces, as in
	 * `Month {YYYY-MM}`.
	 */
	monthlyNoteName: string;
}

/** The nutrition metric: what was eaten on a day. */
export interface NutritionSettings {
	/** Whether the totals are counted at all. */
	enabled: boolean;
	/** Folder the eating records are kept in, subfolders included. */
	recordsFolder: string;
	/** The properties of a daily note the totals are written to. */
	properties: NutritionProperties;
}

/** The open tasks metric: how many tasks of the note are still to be done. */
export interface OpenTasksSettings {
	/** Whether the open tasks are counted at all. */
	enabled: boolean;
	/** The property of a daily note the count is written to. */
	property: string;
}

/** Everything the plugin remembers between sessions. */
export interface MyDailiesSettings {
	dailyNotes: DailyNotesSettings;
	navigation: NavigationSettings;
	nutrition: NutritionSettings;
	openTasks: OpenTasksSettings;
}

/** The properties the totals are written to unless the user renames them. */
export const DEFAULT_NUTRITION_PROPERTIES: NutritionProperties = {
	calories: "calories",
	protein: "protein",
	fat: "fat",
	carbs: "carbs",
	water: "water",
};

/** The property the open tasks are counted into unless the user renames it. */
export const DEFAULT_OPEN_TASKS_PROPERTY = "tasks";

/** The settings a fresh installation starts with. */
export const DEFAULT_SETTINGS: MyDailiesSettings = {
	dailyNotes: { folder: "", autoUpdate: false },
	navigation: { monthlyNotesFolder: "", monthlyNoteName: DEFAULT_MONTHLY_NOTE_NAME },
	nutrition: {
		enabled: false,
		recordsFolder: "",
		properties: { ...DEFAULT_NUTRITION_PROPERTIES },
	},
	openTasks: { enabled: false, property: DEFAULT_OPEN_TASKS_PROPERTY },
};

/**
 * Trims a folder as the user typed it down to a vault-relative path: outer
 * whitespace, repeated separators and leading and trailing slashes are dropped.
 * The vault root, however it is written, comes back as an empty string.
 */
export function normalizeFolder(folder: string): string {
	return folder.trim().replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}

/**
 * Trims a property as the user typed it. A property that names nothing falls
 * back to its default, so that a run never writes to a nameless one.
 */
export function normalizeProperty(property: string, fallback: string): string {
	return property.trim() === "" ? fallback : property.trim();
}

/**
 * Whether a vault path sits in the folder or in one of its subfolders. Paths are
 * compared case-insensitively, and a folder that names nothing — a blank row, or
 * the vault root — holds nothing.
 */
export function isInFolder(path: string, folder: string): boolean {
	const normalized = normalizeFolder(folder);

	if (normalized === "") {
		return false;
	}

	return path.toLowerCase().startsWith(`${normalized.toLowerCase()}/`);
}

function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

/** Reads the property names back, filling in the ones that name nothing. */
function readNutritionProperties(data: unknown): NutritionProperties {
	const stored = asRecord(data);
	const properties = {} as NutritionProperties;

	for (const nutrient of NUTRIENTS) {
		const fallback = DEFAULT_NUTRITION_PROPERTIES[nutrient];

		properties[nutrient] = normalizeProperty(asString(stored[nutrient], fallback), fallback);
	}

	return properties;
}

/**
 * Reads the settings back as they were stored, filling in everything that is
 * missing or of the wrong shape with its default.
 *
 * The nutrition settings once sat flat at the top, before there was more than
 * one thing to count for a day. They are still read from there when the nested
 * ones are missing, so that an installation that was set up back then keeps its
 * folders. A metric that was configured then was on by the very fact of having
 * a records folder, which is what it is taken to mean here.
 *
 * The navigation block was a plugin of its own, the Daily Note Navigator, and
 * its two settings sat flat at the top of its own `data.json`. They are still
 * read from there, so that its file, copied over, brings the monthly notes
 * along with it.
 *
 * The image folders once sat here as well. They belong to My Images now, and
 * whatever a `data.json` still says about them is quietly left alone.
 */
export function readSettings(data: unknown): MyDailiesSettings {
	const stored = asRecord(data);
	const dailyNotes = asRecord(stored.dailyNotes);
	const nutrition = asRecord(stored.nutrition);
	const navigation = asRecord(stored.navigation);
	const openTasks = asRecord(stored.openTasks);
	const oldRecordsFolder = asString(stored.nutritionRecordsFolder, "");

	return {
		dailyNotes: {
			folder: asString(dailyNotes.folder, asString(stored.dailyNotesFolder, "")),
			autoUpdate: asBoolean(
				dailyNotes.autoUpdate,
				asBoolean(stored.autoUpdateNutrition, DEFAULT_SETTINGS.dailyNotes.autoUpdate),
			),
		},
		navigation: {
			monthlyNotesFolder: asString(
				navigation.monthlyNotesFolder,
				asString(stored.monthlyNotesFolder, ""),
			),
			monthlyNoteName: normalizeProperty(
				asString(
					navigation.monthlyNoteName,
					asString(stored.monthlyNoteNameTemplate, DEFAULT_MONTHLY_NOTE_NAME),
				),
				DEFAULT_MONTHLY_NOTE_NAME,
			),
		},
		nutrition: {
			enabled: asBoolean(nutrition.enabled, normalizeFolder(oldRecordsFolder) !== ""),
			recordsFolder: asString(nutrition.recordsFolder, oldRecordsFolder),
			properties: readNutritionProperties(
				nutrition.properties ?? stored.nutritionProperties,
			),
		},
		openTasks: {
			enabled: asBoolean(openTasks.enabled, DEFAULT_SETTINGS.openTasks.enabled),
			property: normalizeProperty(
				asString(openTasks.property, DEFAULT_OPEN_TASKS_PROPERTY),
				DEFAULT_OPEN_TASKS_PROPERTY,
			),
		},
	};
}
