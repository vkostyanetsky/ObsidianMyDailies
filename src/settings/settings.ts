import { fileExtension } from "../images/paths";
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
export interface ToolboxSettings {
	/**
	 * Folders whose notes take part in the automatic renaming, as vault-relative
	 * paths, exactly as the user typed them.
	 */
	imageFolders: string[];
	/** Whether the notes of those folders are processed on their own. */
	autoRenameImages: boolean;
	dailyNotes: DailyNotesSettings;
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
export const DEFAULT_SETTINGS: ToolboxSettings = {
	imageFolders: [],
	autoRenameImages: false,
	dailyNotes: { folder: "", autoUpdate: false },
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

/** Whether any folder of the settings names a folder of the vault at all. */
export function hasFolders(folders: string[]): boolean {
	return folders.some((folder) => normalizeFolder(folder) !== "");
}

/** Whether a vault path sits in any of the folders. */
export function isInAnyFolder(path: string, folders: string[]): boolean {
	return folders.some((folder) => isInFolder(path, folder));
}

/** Whether the path names a Markdown note. */
export function isMarkdownPath(path: string): boolean {
	return fileExtension(path).toLowerCase() === "md";
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
 */
export function readSettings(data: unknown): ToolboxSettings {
	const stored = asRecord(data);
	const folders = stored.imageFolders;
	const dailyNotes = asRecord(stored.dailyNotes);
	const nutrition = asRecord(stored.nutrition);
	const openTasks = asRecord(stored.openTasks);
	const oldRecordsFolder = asString(stored.nutritionRecordsFolder, "");

	return {
		imageFolders: Array.isArray(folders)
			? folders.filter((folder): folder is string => typeof folder === "string")
			: [...DEFAULT_SETTINGS.imageFolders],
		autoRenameImages: asBoolean(stored.autoRenameImages, DEFAULT_SETTINGS.autoRenameImages),
		dailyNotes: {
			folder: asString(dailyNotes.folder, asString(stored.dailyNotesFolder, "")),
			autoUpdate: asBoolean(
				dailyNotes.autoUpdate,
				asBoolean(stored.autoUpdateNutrition, DEFAULT_SETTINGS.dailyNotes.autoUpdate),
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
