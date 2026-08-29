/*
 * The navigation a daily note carries: the day before it and the day after it,
 * the month it belongs to and the months on either side of that one.
 *
 * Nothing here knows about the vault or about Moment. The block is written out
 * as Markdown and handed back, which is what makes it something a test can look
 * at; the wording of a day and of a month comes from outside, so that both are
 * written the way the vault is set to write them.
 */

import { monthOf, shiftDay, shiftMonth } from "./dates";

/** How a monthly note is named unless the user names it otherwise. */
export const DEFAULT_MONTHLY_NOTE_NAME = "Month {YYYY-MM}";

/** Where the notes the block points at are kept, and how they are named. */
export interface NavigationPlaces {
	/** Folder the daily notes sit in, empty for the vault root. */
	dailyNotesFolder: string;
	/** Folder the monthly notes sit in, empty for the vault root. */
	monthlyNotesFolder: string;
	/** Name of a monthly note, with the month in curly braces. */
	monthlyNoteName: string;
}

/** How a day and a month are written out, in the language of the vault. */
export interface DateWording {
	/** A day in a format of Moment's, such as `dddd` for its weekday. */
	day(date: string, format: string): string;
	/** A month in a format of Moment's, such as `MMM` or `YYYY-MM`. */
	month(yearMonth: string, format: string): string;
}

/** Joins a folder and a name, tolerating an empty folder. */
function notePath(folder: string, name: string): string {
	return folder === "" ? name : `${folder}/${name}`;
}

/** A link to a note, under a name of its own. */
function noteLink(path: string, label: string): string {
	return `[[${path}|${label}]]`;
}

/** The first letter of a word as the start of a sentence writes it. */
function capitalize(value: string): string {
	return value === "" ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * The name of the monthly note of a month. Every `{...}` of the template is a
 * format of Moment's, applied to the month: `Month {YYYY-MM}` comes out as
 * `Month 2026-08`. Everything outside the braces is kept as it is, and a
 * template that names nothing falls back to the default.
 */
export function monthlyNoteName(
	yearMonth: string,
	template: string,
	wording: DateWording,
): string {
	const wanted = template.trim() === "" ? DEFAULT_MONTHLY_NOTE_NAME : template.trim();

	return wanted.replace(/\{([^{}]*)\}/g, (match, format: string) =>
		format === "" ? match : wording.month(yearMonth, format),
	);
}

/** Every line of the content of the block, as a line of the callout. */
function quoteForCallout(source: string): string[] {
	return source
		.replace(/\r\n|\r/g, "\n")
		.split("\n")
		.map((line) => (line === "" ? ">" : `> ${line}`));
}

/** The link to the monthly note of a month, labelled after the month. */
function monthLink(yearMonth: string, places: NavigationPlaces, wording: DateWording): string {
	return noteLink(
		notePath(
			places.monthlyNotesFolder,
			monthlyNoteName(yearMonth, places.monthlyNoteName, wording),
		),
		wording.month(yearMonth, "MMM").toUpperCase(),
	);
}

/** The link to the daily note of a day, labelled after the day. */
function dayLink(date: string, places: NavigationPlaces): string {
	return noteLink(notePath(places.dailyNotesFolder, date), date);
}

/**
 * The navigation of one daily note, as the Markdown it is rendered from: the
 * weekday it fell on and the days on either side of it, in a callout; the
 * months around it on a line of their own below; and whatever the block itself
 * carries under that, quoted.
 *
 * The lines are laid out exactly as the Daily Note Navigator laid them out, so
 * that a note that carried the block before carries the same block now.
 */
export function buildDashboard(
	date: string,
	places: NavigationPlaces,
	wording: DateWording,
	source = "",
): string {
	const month = monthOf(date);
	const lines = [
		`> [!seealso] ${capitalize(wording.day(date, "dddd"))}`,
		`> 📅 ${dayLink(shiftDay(date, -1), places)} ← ${date} → ` +
			`${dayLink(shiftDay(date, 1), places)}`,
		"> ",
		`${monthLink(shiftMonth(month, -1), places, wording)} ⬅️ ` +
			`${monthLink(month, places, wording)} ➡️ ` +
			`${monthLink(shiftMonth(month, 1), places, wording)}`,
	];

	if (source.trim() !== "") {
		lines.push(">", ...quoteForCallout(source));
	}

	return lines.join("\n");
}
