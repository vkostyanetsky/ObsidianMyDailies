import { fileExtension } from "../images/paths";
import type { Nutrient } from "../nutrition/totals";
import { NUTRIENTS } from "../nutrition/totals";

/** The property each nutrient is written to, by nutrient. */
export type NutritionProperties = Record<Nutrient, string>;

/** Everything the plugin remembers between sessions. */
export interface ToolboxSettings {
	/**
	 * Folders whose notes take part in the automatic renaming, as vault-relative
	 * paths, exactly as the user typed them.
	 */
	imageFolders: string[];
	/** Whether the notes of those folders are processed on their own. */
	autoRenameImages: boolean;
	/**
	 * Folder the eating records are kept in, subfolders included. An empty
	 * folder switches the nutrition sums off altogether.
	 */
	nutritionRecordsFolder: string;
	/**
	 * Folder the daily notes are kept in. Left empty, the folder of the core
	 * Daily notes plugin is used.
	 */
	dailyNotesFolder: string;
	/** The properties of a daily note the totals of its day are written to. */
	nutritionProperties: NutritionProperties;
	/** Whether every daily note is worked out once when the vault is opened. */
	autoUpdateNutrition: boolean;
}

/** The properties the totals are written to unless the user renames them. */
export const DEFAULT_NUTRITION_PROPERTIES: NutritionProperties = {
	calories: "calories",
	protein: "protein",
	fat: "fat",
	carbs: "carbs",
	water: "water",
};

/** The settings a fresh installation starts with. */
export const DEFAULT_SETTINGS: ToolboxSettings = {
	imageFolders: [],
	autoRenameImages: false,
	nutritionRecordsFolder: "",
	dailyNotesFolder: "",
	nutritionProperties: { ...DEFAULT_NUTRITION_PROPERTIES },
	autoUpdateNutrition: false,
};

/**
 * Trims a property as the user typed it. A property that names nothing falls
 * back to its default, so that a run never writes to a nameless one.
 */
export function normalizeProperty(property: string, fallback: string): string {
	return property.trim() === "" ? fallback : property.trim();
}

/**
 * Trims a folder as the user typed it down to a vault-relative path: outer
 * whitespace, repeated separators and leading and trailing slashes are dropped.
 * The vault root, however it is written, comes back as an empty string.
 */
export function normalizeFolder(folder: string): string {
	return folder.trim().replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
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
function readProperties(data: unknown): NutritionProperties {
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
 */
export function readSettings(data: unknown): ToolboxSettings {
	const stored = asRecord(data);
	const folders = stored.imageFolders;

	return {
		imageFolders: Array.isArray(folders)
			? folders.filter((folder): folder is string => typeof folder === "string")
			: [...DEFAULT_SETTINGS.imageFolders],
		autoRenameImages: asBoolean(stored.autoRenameImages, DEFAULT_SETTINGS.autoRenameImages),
		nutritionRecordsFolder: asString(
			stored.nutritionRecordsFolder,
			DEFAULT_SETTINGS.nutritionRecordsFolder,
		),
		dailyNotesFolder: asString(stored.dailyNotesFolder, DEFAULT_SETTINGS.dailyNotesFolder),
		nutritionProperties: readProperties(stored.nutritionProperties),
		autoUpdateNutrition: asBoolean(
			stored.autoUpdateNutrition,
			DEFAULT_SETTINGS.autoUpdateNutrition,
		),
	};
}
