/*
 * Telling a daily note apart from any other note.
 *
 * The base decides the same way — `date.format("YYYY-MM-DD") == this.file.name`
 * — so a note stands for a day when it is named after one, and the day it
 * stands for is its own name. Anything else in the folder, an attachment or a
 * drawing named after the day it was made on, is left alone.
 */

import { isInFolder, normalizeFolder } from "../settings/settings";

/** How a daily note is named, matching the format the base compares against. */
const DAILY_NOTE_NAME = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The number of days the month of that year has. */
function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * The day a note named `basename` stands for, or `null` when it is not named
 * after a day at all. A name that reads like a date but names no day there is
 * — the thirty-first of February — is not one either.
 */
export function dailyNoteDate(basename: string): string | null {
	const match = DAILY_NOTE_NAME.exec(basename);

	if (match === null) {
		return null;
	}

	const [, year, month, day] = match.map(Number);

	if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
		return null;
	}

	return basename;
}

/**
 * Whether the note sits where the daily notes are kept. A folder that names
 * nothing is the vault itself, which is where the daily notes of a vault that
 * keeps them at the root sit.
 */
export function isInDailyNotesFolder(path: string, folder: string): boolean {
	return normalizeFolder(folder) === "" || isInFolder(path, folder);
}
