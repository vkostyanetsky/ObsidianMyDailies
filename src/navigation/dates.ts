/*
 * The days and the months the navigation block points at.
 *
 * A day is written the way a daily note is named, `YYYY-MM-DD`, and a month
 * the way it opens, `YYYY-MM`. Everything is counted in UTC, so that a day
 * never gains or loses an hour on the way to the day before it.
 */

/** The day as a moment of UTC midnight. */
function utcDay(date: string): Date {
	const [year, month, day] = date.split("-").map(Number);

	return new Date(Date.UTC(year, month - 1, day));
}

/** A day as `YYYY-MM-DD`. */
function formatDay(date: Date): string {
	return `${formatMonth(date)}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/** A month as `YYYY-MM`. */
function formatMonth(date: Date): string {
	return `${String(date.getUTCFullYear()).padStart(4, "0")}-${String(
		date.getUTCMonth() + 1,
	).padStart(2, "0")}`;
}

/** The day a number of days away from this one, in either direction. */
export function shiftDay(date: string, days: number): string {
	const shifted = utcDay(date);

	shifted.setUTCDate(shifted.getUTCDate() + days);

	return formatDay(shifted);
}

/** The month the day belongs to. */
export function monthOf(date: string): string {
	return formatMonth(utcDay(date));
}

/**
 * Every day of the month, from the first to the last. A month that names no
 * month there is — the thirteenth of a year — has no days at all.
 */
export function daysOfMonth(yearMonth: string): string[] {
	const day = utcDay(`${yearMonth}-01`);
	const days: string[] = [];

	while (formatMonth(day) === yearMonth) {
		days.push(formatDay(day));
		day.setUTCDate(day.getUTCDate() + 1);
	}

	return days;
}

/**
 * The month a number of months away from this one. Months are counted from
 * their first day, so no shift ever lands on a day the month does not have.
 */
export function shiftMonth(yearMonth: string, months: number): string {
	const shifted = utcDay(`${yearMonth}-01`);

	shifted.setUTCMonth(shifted.getUTCMonth() + months);

	return formatMonth(shifted);
}
