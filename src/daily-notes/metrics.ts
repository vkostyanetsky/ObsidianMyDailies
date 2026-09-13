/*
 * Working out the properties a daily note carries.
 *
 * Every kind of number the plugin counts for a day — what was eaten, how many
 * tasks are still open — is a metric, and a metric only ever answers what its
 * own properties come to. Writing is not its business: all the metrics of a
 * run are asked first, their properties are merged, and the note is written
 * once, and only when a value would come out different from what it says.
 *
 * Nothing here runs on its own. A run is always asked for, by one of the two
 * commands or once when the vault has been read in.
 */

import { describeError } from "../log";
import type { FrontmatterValue } from "../markdown/frontmatter";
import { setFrontmatterValues } from "../markdown/frontmatter";

/** A note of the vault that stands for a day. */
export interface DailyNote {
	/** Vault path of the note. */
	path: string;
	/** The day it stands for, as `YYYY-MM-DD`. */
	date: string;
}

/**
 * What a metric contributes to a note: property name to value. A `null` value
 * is a property the metric owns but has nothing to say for, and it is written
 * as an empty one rather than as a number.
 */
export type MetricValues = Record<string, number | string | null>;

/**
 * A counted number as a metric value. Nothing counted is nothing to say, and
 * a property that would read `0` is left empty instead.
 */
export function countedValue(value: number): number | null {
	return value === 0 ? null : value;
}

/** What one metric came to for one note. */
export interface MetricResult {
	/** A value for each of the properties the metric owns. */
	values: MetricValues;
	/** The metric's share of the notice, such as "3 open tasks". */
	summary: string;
}

/** A metric that has read what it needs and can now be asked about a day. */
export interface DayMetric {
	measure(note: DailyNote): MetricResult;
}

/**
 * One kind of number a daily note carries. A source is opened once per run:
 * whatever it has to read from the vault it reads there, so that a run over a
 * thousand notes does not read it a thousand times over.
 */
export interface DayMetricSource {
	/** Stable name of the metric, used in the log. */
	readonly id: string;
	/** The properties the metric owns. It never writes to any other. */
	readonly properties: string[];
	/** Reads what the metric needs and hands back something to ask. */
	open(): DayMetric;
}

/** Everything a run needs from the vault, the metrics left aside. */
export interface DailyNotesHost {
	/** Every note of the vault that stands for a day. */
	dailyNotes(): DailyNote[];
	/**
	 * What the note already says, as it would be written, with `null` for a
	 * property it does not carry.
	 */
	storedValues(note: DailyNote, properties: string[]): Record<string, string | null>;
	/** Rewrites the note, or does nothing when `update` returns `null`. */
	updateNote(note: DailyNote, update: (source: string) => string | null): Promise<void>;
}

/** What became of a run over one daily note. */
export type DailyNoteOutcome =
	| { kind: "nothing-to-count" }
	| { kind: "clashing-properties"; properties: string[] }
	| { kind: "failed"; message: string }
	| { kind: "written"; note: DailyNote; summaries: string[] }
	| { kind: "unchanged"; note: DailyNote; summaries: string[] };

/** What became of a run over every daily note of the vault. */
export interface DailyNotesRunSummary {
	/** How many daily notes were looked at. */
	notes: number;
	/** How many of them were written. */
	written: number;
	/** The ones that could not be written, by path and reason. */
	failures: { note: string; message: string }[];
}

/**
 * A value as it ends up in the note, which is also how it is compared. Nothing
 * to say is written as a blank, which leaves the property there and empty.
 */
function written(value: number | string | null): string {
	return value === null ? "" : String(value);
}

/**
 * The properties more than one metric claims. Two metrics writing to the same
 * property would overwrite each other on every run, so a run that finds any
 * refuses to write rather than churn the notes.
 */
export function clashingProperties(sources: DayMetricSource[]): string[] {
	const seen = new Set<string>();
	const clashing: string[] = [];

	for (const source of sources) {
		for (const property of source.properties) {
			if (seen.has(property)) {
				if (!clashing.includes(property)) {
					clashing.push(property);
				}
			} else {
				seen.add(property);
			}
		}
	}

	return clashing;
}

/** Every property of the run, in the order the metrics were given in. */
function allProperties(sources: DayMetricSource[]): string[] {
	return sources.flatMap((source) => source.properties);
}

/**
 * Asks every metric about the note and writes the answers, unless the note
 * already says exactly that. The opened metrics are handed in so that a run
 * over the whole vault opens them once instead of once per note.
 */
async function updateNote(
	host: DailyNotesHost,
	sources: DayMetricSource[],
	metrics: DayMetric[],
	note: DailyNote,
): Promise<DailyNoteOutcome> {
	const values: MetricValues = {};
	const summaries: string[] = [];

	for (const metric of metrics) {
		const result = metric.measure(note);

		Object.assign(values, result.values);
		summaries.push(result.summary);
	}

	// Only the properties the metrics declared are ever touched, and they are
	// written in the order the metrics were given in.
	const properties = allProperties(sources).filter((property) => property in values);
	const stored = host.storedValues(note, properties);
	const entries: FrontmatterValue[] = properties.map((property) => ({
		key: property,
		value: written(values[property]),
	}));

	if (entries.every((entry) => stored[entry.key] === entry.value)) {
		return { kind: "unchanged", note, summaries };
	}

	try {
		await host.updateNote(note, (source) => setFrontmatterValues(source, entries));
	} catch (error) {
		return { kind: "failed", message: describeError(error) };
	}

	return { kind: "written", note, summaries };
}

/** Works out and writes the properties of a single note. */
export async function updateDailyNote(
	host: DailyNotesHost,
	sources: DayMetricSource[],
	note: DailyNote,
): Promise<DailyNoteOutcome> {
	if (sources.length === 0) {
		return { kind: "nothing-to-count" };
	}

	const clashing = clashingProperties(sources);

	if (clashing.length > 0) {
		return { kind: "clashing-properties", properties: clashing };
	}

	return updateNote(
		host,
		sources,
		sources.map((source) => source.open()),
		note,
	);
}

/**
 * Goes through every daily note of the vault. The metrics are opened once, so
 * that whatever they read from the vault they read a single time.
 */
export async function updateAllDailyNotes(
	host: DailyNotesHost,
	sources: DayMetricSource[],
): Promise<DailyNotesRunSummary | DailyNoteOutcome> {
	if (sources.length === 0) {
		return { kind: "nothing-to-count" };
	}

	const clashing = clashingProperties(sources);

	if (clashing.length > 0) {
		return { kind: "clashing-properties", properties: clashing };
	}

	const metrics = sources.map((source) => source.open());
	const notes = host.dailyNotes();
	const summary: DailyNotesRunSummary = { notes: notes.length, written: 0, failures: [] };

	for (const note of notes) {
		const outcome = await updateNote(host, sources, metrics, note);

		if (outcome.kind === "written") {
			summary.written += 1;
		} else if (outcome.kind === "failed") {
			summary.failures.push({ note: note.path, message: outcome.message });
		}
	}

	return summary;
}

/** Turns the outcome of a single note into the line a notice shows. */
export function describeDailyNoteOutcome(outcome: DailyNoteOutcome): string {
	switch (outcome.kind) {
		case "nothing-to-count":
			return "Nothing is counted for a daily note. Switch a metric on in the settings of the plugin.";
		case "clashing-properties":
			return (
				`Nothing was written: ${outcome.properties.join(", ")} ` +
				`${outcome.properties.length === 1 ? "is claimed" : "are claimed"} by more than ` +
				"one metric. Give each of them a property of its own in the settings."
			);
		case "failed":
			return `Nothing was written: ${outcome.message}`;
		case "unchanged":
		case "written": {
			const state = outcome.kind === "written" ? "Wrote" : "Unchanged";

			return `${state} ${outcome.note.date}: ${outcome.summaries.join("; ")}.`;
		}
	}
}

/** Turns the outcome of a run over the whole vault into one line. */
export function describeDailyNotesRun(summary: DailyNotesRunSummary): string {
	const notes = `${summary.notes} daily ${summary.notes === 1 ? "note" : "notes"}`;
	const line = `Daily notes: ${summary.written} of ${notes} updated`;

	return summary.failures.length === 0
		? `${line}.`
		: `${line}, ${summary.failures.length} left alone (see the console).`;
}
