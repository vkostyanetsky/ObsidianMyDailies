/*
 * Binding the days of a month to the vault: which note in front of the user
 * stands for a month, and how an empty daily note comes into being.
 *
 * A note stands for a month when its name reads the way the Monthly note name
 * setting writes one — the same setting the navigation block names its links
 * after — and when it sits where the monthly notes are kept.
 */

import type { App, TFile } from "obsidian";
import { moment, normalizePath } from "obsidian";

import { log } from "../log";
import { monthlyNoteFormat } from "../navigation/dashboard";
import type { MyDailiesSettings } from "../settings/settings";
import { isInFolder, normalizeFolder } from "../settings/settings";
import type { MonthDaysHost } from "./days";

/** How a month is written wherever the plugin passes one around. */
const MONTH_FORMAT = "YYYY-MM";

/**
 * Whether the note sits where the monthly notes are kept. A folder that names
 * nothing is the vault itself, as it is for the daily notes.
 */
export function isInMonthlyNotesFolder(path: string, folder: string): boolean {
	return normalizeFolder(folder) === "" || isInFolder(path, folder);
}

/**
 * The month the name of a note stands for, or `null` when it stands for none.
 * The name is read strictly against the template the settings carry, so a note
 * named anything else than a month — however close it comes — names no month.
 */
export function monthOfNoteName(basename: string, template: string): string | null {
	const read = moment(basename, monthlyNoteFormat(template), true);

	return read.isValid() ? read.format(MONTH_FORMAT) : null;
}

/**
 * The month the note stands for, or `null` when it does not stand for one: a
 * note that is named after a month and sits where the monthly notes are kept.
 */
export function monthlyNoteMonth(file: TFile, settings: MyDailiesSettings): string | null {
	if (file.extension !== "md") {
		return null;
	}

	if (!isInMonthlyNotesFolder(file.path, settings.navigation.monthlyNotesFolder)) {
		return null;
	}

	return monthOfNoteName(file.basename, settings.navigation.monthlyNoteName);
}

/** Creates the folder of a note, and whatever folder that one sits in. */
async function createFolderOf(app: App, path: string): Promise<void> {
	const segments = path.split("/").slice(0, -1);
	let folder = "";

	for (const segment of segments) {
		folder = folder === "" ? segment : `${folder}/${segment}`;

		if (app.vault.getFolderByPath(folder) === null) {
			log(`creating the folder "${folder}"`);

			await app.vault.createFolder(folder);
		}
	}
}

/**
 * Binds the filling of a month with daily notes to the vault.
 *
 * Every path the vault holds is taken down once, in lower case, and a day
 * whose note is among them is left alone. The comparison ignores the case for
 * the same reason the folders of the settings do: a folder typed as "days"
 * must not have a second note created next to the one that already sits in
 * "Days". Nothing but a path that is nowhere in the vault is ever written to,
 * and it is written by creating it — no note that was already there is opened,
 * let alone overwritten.
 */
export function createMonthDaysHost(app: App): MonthDaysHost {
	const paths = new Set(app.vault.getFiles().map((file) => file.path.toLowerCase()));

	return {
		hasNote: (path) => paths.has(normalizePath(path).toLowerCase()),

		createNote: async (path) => {
			const normalized = normalizePath(path);

			// The daily notes folder need not be there yet: a vault that keeps
			// its months and its days apart may well have only the months.
			await createFolderOf(app, normalized);

			log(`creating the daily note "${normalized}"`);

			await app.vault.create(normalized, "");

			paths.add(normalized.toLowerCase());
		},
	};
}
