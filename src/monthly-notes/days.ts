/*
 * Filling a month with the daily notes it has none for yet.
 *
 * Nothing here knows about the vault: the days of the month are worked out and
 * handed over one by one, which is what makes the run something a test can
 * drive. A day the vault already has a note for is never touched, and the
 * notes that are created carry nothing at all — what a daily note is to say is
 * written by the metrics, or by the hand that opens it.
 */

import { describeError } from "../log";
import { notePath } from "../navigation/dashboard";
import { daysOfMonth } from "../navigation/dates";

/** Everything filling a month with daily notes needs from the vault. */
export interface MonthDaysHost {
	/** Whether a note already sits at that path. */
	hasNote(path: string): boolean;
	/** Creates an empty note at that path. */
	createNote(path: string): Promise<void>;
}

/** What became of a run over the days of one month. */
export interface MonthDaysRunSummary {
	/** The month the days belong to, as `YYYY-MM`. */
	month: string;
	/** How many days that month has. */
	days: number;
	/** How many notes were created. */
	created: number;
	/** The ones that could not be created, by path and reason. */
	failures: { note: string; message: string }[];
}

/** The path the daily note of a day sits at. */
export function dailyNotePath(folder: string, date: string): string {
	return notePath(folder, `${date}.md`);
}

/**
 * Creates an empty daily note for every day of the month the folder has none
 * for. The days are gone through in order, and a day that could not be written
 * does not stop the ones after it.
 */
export async function createMonthDays(
	host: MonthDaysHost,
	month: string,
	folder: string,
): Promise<MonthDaysRunSummary> {
	const days = daysOfMonth(month);
	const summary: MonthDaysRunSummary = {
		month,
		days: days.length,
		created: 0,
		failures: [],
	};

	for (const day of days) {
		const path = dailyNotePath(folder, day);

		if (host.hasNote(path)) {
			continue;
		}

		try {
			await host.createNote(path);

			summary.created += 1;
		} catch (error) {
			summary.failures.push({ note: path, message: describeError(error) });
		}
	}

	return summary;
}

/** Turns the outcome of such a run into the line a notice shows. */
export function describeMonthDaysRun(summary: MonthDaysRunSummary): string {
	if (summary.days === 0) {
		return `${summary.month} does not name a month.`;
	}

	if (summary.created === 0 && summary.failures.length === 0) {
		return `${summary.month}: every one of its ${summary.days} days already has a note.`;
	}

	const days = `${summary.days} ${summary.days === 1 ? "day" : "days"}`;
	const line = `${summary.month}: ${summary.created} of ${days} created`;

	return summary.failures.length === 0
		? `${line}.`
		: `${line}, ${summary.failures.length} left alone (see the console).`;
}
