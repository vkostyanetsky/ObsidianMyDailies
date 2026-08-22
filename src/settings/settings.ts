import { fileExtension } from "../images/paths";

/** Everything the plugin remembers between sessions. */
export interface ToolboxSettings {
	/**
	 * Folders whose notes take part in the automatic renaming, as vault-relative
	 * paths, exactly as the user typed them.
	 */
	imageFolders: string[];
	/** Whether the notes of those folders are processed on their own. */
	autoRenameImages: boolean;
}

/** The settings a fresh installation starts with. */
export const DEFAULT_SETTINGS: ToolboxSettings = {
	imageFolders: [],
	autoRenameImages: false,
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
		autoRenameImages:
			typeof stored.autoRenameImages === "boolean"
				? stored.autoRenameImages
				: DEFAULT_SETTINGS.autoRenameImages,
	};
}
