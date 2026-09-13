/*
 * Binding a run over the daily notes to the vault: which notes stand for a
 * day, what they already say, and how one of them is written back.
 */

import type { App, CachedMetadata, TFile } from "obsidian";

import { log, logProblem } from "../log";
import type { MyDailiesSettings } from "../settings/settings";
import { normalizeFolder } from "../settings/settings";
import { dailyNoteDate, isInDailyNotesFolder } from "./notes";
import type { DailyNote, DailyNotesHost } from "./metrics";

/** The frontmatter of a note, or an empty one when it has none. */
export function frontmatterOf(app: App, file: TFile): Record<string, unknown> {
	const cache: CachedMetadata | null = app.metadataCache.getFileCache(file);

	return cache?.frontmatter ?? {};
}

/**
 * A stored property as it would have to be written, or `null` when the note
 * does not carry it in a form a metric could have written. A property that is
 * there but holds nothing is parsed as `null` by Obsidian and reads back as
 * the blank a metric writes when it has nothing to say.
 */
function storedValue(value: unknown): string | null {
	if (value === null) {
		return "";
	}

	if (typeof value === "number") {
		return Number.isFinite(value) ? String(value) : null;
	}

	return typeof value === "string" ? value : null;
}

/**
 * The folder the daily notes sit in: the one named in the settings, or, when
 * that is left empty, the one the core Daily notes plugin keeps them in.
 */
export function dailyNotesFolder(app: App, settings: MyDailiesSettings): string {
	const configured = normalizeFolder(settings.dailyNotes.folder);

	if (configured !== "") {
		return configured;
	}

	const internal = (
		app as App & {
			internalPlugins?: {
				getPluginById(id: string): { instance?: { options?: unknown } } | null;
			};
		}
	).internalPlugins;
	const options = internal?.getPluginById("daily-notes")?.instance?.options;
	const folder = (options as { folder?: unknown } | undefined)?.folder;

	return typeof folder === "string" ? normalizeFolder(folder) : "";
}

/** Binds a run over the daily notes to the vault. */
export function createDailyNotesHost(app: App, settings: MyDailiesSettings): DailyNotesHost {
	const folder = dailyNotesFolder(app, settings);

	return {
		dailyNotes: () => {
			const notes: DailyNote[] = [];

			for (const file of app.vault.getMarkdownFiles()) {
				const date = dailyNoteDate(file.basename);

				if (date !== null && isInDailyNotesFolder(file.path, folder)) {
					notes.push({ path: file.path, date });
				}
			}

			return notes;
		},

		storedValues: (note, properties) => {
			const file = app.vault.getFileByPath(note.path);
			const frontmatter = file === null ? {} : frontmatterOf(app, file);
			const stored: Record<string, string | null> = {};

			for (const property of properties) {
				stored[property] = storedValue(frontmatter[property]);
			}

			return stored;
		},

		updateNote: async (note, update) => {
			const file = app.vault.getFileByPath(note.path);

			if (file === null) {
				throw new Error(`there is no note at "${note.path}"`);
			}

			log(`writing the properties of ${note.date} to "${note.path}"`);

			await app.vault.process(file, (source) => update(source) ?? source);
		},
	};
}

/** The note, but only when it stands for a day and sits where they are kept. */
export function asDailyNote(app: App, file: TFile, settings: MyDailiesSettings): DailyNote | null {
	const date = dailyNoteDate(file.basename);

	if (date === null || file.extension !== "md") {
		return null;
	}

	return isInDailyNotesFolder(file.path, dailyNotesFolder(app, settings))
		? { path: file.path, date }
		: null;
}

/** Writes the notes a run could not update to the console. */
export function logFailures(failures: { note: string; message: string }[]): void {
	for (const failure of failures) {
		logProblem(`"${failure.note}" was left alone: ${failure.message}`);
	}
}
