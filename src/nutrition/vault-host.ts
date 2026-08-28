/*
 * Binding the nutrition sums to the vault: which notes are records, which are
 * products, which stand for a day, and how a day is written back.
 *
 * The property names the records and the products themselves use are the ones
 * the "Питание" base reads, so they are fixed here; only the properties the
 * totals end up in are the user's to name.
 */

import type { App, CachedMetadata, TFile } from "obsidian";
import { TFile as ObsidianFile } from "obsidian";

import { log, logProblem } from "../log";
import type { ToolboxSettings } from "../settings/settings";
import { isInFolder, normalizeFolder } from "../settings/settings";
import { dailyNoteDate, isInDailyNotesFolder } from "./daily-notes";
import type { NutritionRecord, ProductFacts } from "./totals";
import { NUTRIENTS, noNutrients, readDate, readLinkTarget, readNumber } from "./totals";
import type { DailyNote, NutritionHost } from "./update";

/** The property a record states the day it belongs to in. */
const RECORD_DATE = "date";
/** The property a record links its product in. */
const RECORD_PRODUCT = "product";
/** The property a record states how much was eaten in. */
const RECORD_QUANTITY = "quantity";
/** The property a product states what its nutrients are given for in. */
const PRODUCT_UNIT_SIZE = "unit_size";

/** The frontmatter of a note, or an empty one when it has none. */
function frontmatterOf(app: App, file: TFile): Record<string, unknown> {
	const cache: CachedMetadata | null = app.metadataCache.getFileCache(file);

	return cache?.frontmatter ?? {};
}

/** Reads a record note into what the sum needs of it. */
function readRecord(app: App, file: TFile): NutritionRecord {
	const frontmatter = frontmatterOf(app, file);

	return {
		path: file.path,
		date: readDate(frontmatter[RECORD_DATE]),
		product: readLinkTarget(frontmatter[RECORD_PRODUCT]),
		quantity: readNumber(frontmatter[RECORD_QUANTITY]),
	};
}

/** Reads a product note into the facts it states. */
function readProduct(app: App, file: TFile): ProductFacts {
	const frontmatter = frontmatterOf(app, file);
	const facts = { unitSize: readNumber(frontmatter[PRODUCT_UNIT_SIZE]) } as ProductFacts;

	for (const nutrient of NUTRIENTS) {
		facts[nutrient] = readNumber(frontmatter[nutrient]);
	}

	return facts;
}

/**
 * The folder the daily notes sit in: the one named in the settings, or, when
 * that is left empty, the one the core Daily notes plugin keeps them in.
 */
function dailyNotesFolder(app: App, settings: ToolboxSettings): string {
	const configured = normalizeFolder(settings.dailyNotesFolder);

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

/**
 * Binds the nutrition sums to the vault, or returns `null` when there is no
 * records folder to read and therefore nothing to sum up.
 */
export function createNutritionHost(app: App, settings: ToolboxSettings): NutritionHost | null {
	const recordsFolder = normalizeFolder(settings.nutritionRecordsFolder);

	if (recordsFolder === "") {
		return null;
	}

	const notesFolder = dailyNotesFolder(app, settings);

	// A product is read once per run, however many records point at it.
	const products = new Map<string, ProductFacts>();
	let records: NutritionRecord[] | null = null;

	return {
		properties: { ...settings.nutritionProperties },

		records: () => {
			if (records === null) {
				records = app.vault
					.getMarkdownFiles()
					.filter((file) => isInFolder(file.path, recordsFolder))
					.map((file) => readRecord(app, file));

				log(`nutrition: read ${records.length} records from "${recordsFolder}"`);
			}

			return records;
		},

		productFacts: (record) => {
			if (record.product === null) {
				return null;
			}

			const file = app.metadataCache.getFirstLinkpathDest(record.product, record.path);

			if (!(file instanceof ObsidianFile)) {
				return null;
			}

			const known = products.get(file.path);

			if (known !== undefined) {
				return known;
			}

			const facts = readProduct(app, file);
			products.set(file.path, facts);

			return facts;
		},

		dailyNotes: () => {
			const notes: DailyNote[] = [];

			for (const file of app.vault.getMarkdownFiles()) {
				const date = dailyNoteDate(file.basename);

				if (date !== null && isInDailyNotesFolder(file.path, notesFolder)) {
					notes.push({ path: file.path, date });
				}
			}

			return notes;
		},

		storedNutrients: (note) => {
			const file = app.vault.getFileByPath(note.path);

			if (file === null) {
				return noNutrients();
			}

			const frontmatter = frontmatterOf(app, file);
			const stored = noNutrients();

			for (const nutrient of NUTRIENTS) {
				// A property that is missing or holds anything but a number is
				// not what the run would write, so the note has to be written.
				stored[nutrient] =
					readNumber(frontmatter[settings.nutritionProperties[nutrient]]) ?? Number.NaN;
			}

			return stored;
		},

		updateNote: async (note, update) => {
			const file = app.vault.getFileByPath(note.path);

			if (file === null) {
				throw new Error(`there is no note at "${note.path}"`);
			}

			log(`nutrition: writing the totals of ${note.date} to "${note.path}"`);

			await app.vault.process(file, (source) => update(source) ?? source);
		},
	};
}

/** Whether the note the command was called on stands for a day. */
export function asDailyNote(app: App, file: TFile, settings: ToolboxSettings): DailyNote | null {
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
		logProblem(`nutrition: "${failure.note}" was left alone: ${failure.message}`);
	}
}
