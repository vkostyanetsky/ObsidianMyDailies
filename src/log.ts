/*
 * Debugging output. Everything the plugin does to the vault by itself is
 * written to the developer console, so that a run can be followed after the
 * fact: open it with Ctrl+Shift+I and filter the console by the prefix below.
 */

/** Prefix every line carries, so that the console can be filtered by it. */
const PREFIX = "[My Dailies]";

/** Writes one line of debugging information. */
export function log(message: string): void {
	console.log(`${PREFIX} ${message}`);
}

/** Writes one line about something that did not work out. */
export function logProblem(message: string): void {
	console.warn(`${PREFIX} ${message}`);
}

/** The reason something went wrong, as a line a notice or the log can carry. */
export function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
