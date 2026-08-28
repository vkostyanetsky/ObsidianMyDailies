/*
 * Writing the totals of a day into the daily note that stands for it.
 *
 * Nothing here runs on its own: a run is always asked for, by one of the two
 * commands or once when the vault has been read in. A note is only ever written
 * when its properties would come out different from what they already say.
 */

import type { FrontmatterValue } from "../markdown/frontmatter";
import { setFrontmatterValues } from "../markdown/frontmatter";
import type { DayNutrition, Nutrient, NutritionRecord, Nutrients, ProductFacts } from "./totals";
import { NUTRIENTS, recordsByDay, sameNutrients, sumDay } from "./totals";

/** A note of the vault that stands for a day. */
export interface DailyNote {
	/** Vault path of the note. */
	path: string;
	/** The day it stands for, as `YYYY-MM-DD`. */
	date: string;
}

/**
 * Everything the update needs from its surroundings. Keeping it behind an
 * interface leaves the logic free of the Obsidian API.
 */
export interface NutritionHost {
	/** The property each nutrient is written under, by nutrient. */
	readonly properties: Record<Nutrient, string>;
	/** Every record note of the records folder, already read. */
	records(): NutritionRecord[];
	/** What the product of a record states, or `null` for a broken link. */
	productFacts(record: NutritionRecord): ProductFacts | null;
	/** Every note of the vault that stands for a day. */
	dailyNotes(): DailyNote[];
	/** What the note already says, so that an unchanged note can be skipped. */
	storedNutrients(note: DailyNote): Nutrients;
	/** Rewrites the note, or does nothing when `update` returns `null`. */
	updateNote(note: DailyNote, update: (source: string) => string | null): Promise<void>;
}

/** What became of a run over one daily note. */
export type NutritionOutcome =
	| { kind: "not-configured" }
	| { kind: "failed"; message: string }
	| { kind: "written"; note: DailyNote; day: DayNutrition }
	| { kind: "unchanged"; note: DailyNote; day: DayNutrition };

/** What became of a run over every daily note of the vault. */
export interface NutritionRunSummary {
	/** How many daily notes were looked at. */
	notes: number;
	/** How many of them were written. */
	written: number;
	/** The ones that could not be written, by name and reason. */
	failures: { note: string; message: string }[];
}

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** The totals as they have to stand in the frontmatter. */
function frontmatterValues(host: NutritionHost, totals: Nutrients): FrontmatterValue[] {
	return NUTRIENTS.map((nutrient) => ({
		key: host.properties[nutrient],
		value: String(totals[nutrient]),
	}));
}

/**
 * Works out the day of one note and writes it, unless the note already says
 * exactly that. The records are handed in so that a run over the whole vault
 * reads them once instead of once per note.
 */
async function updateNote(
	host: NutritionHost,
	note: DailyNote,
	records: NutritionRecord[],
): Promise<NutritionOutcome> {
	const day = sumDay(note.date, records, (record) => host.productFacts(record));

	if (sameNutrients(day.totals, host.storedNutrients(note))) {
		return { kind: "unchanged", note, day };
	}

	const values = frontmatterValues(host, day.totals);

	try {
		await host.updateNote(note, (source) => setFrontmatterValues(source, values));
	} catch (error) {
		return { kind: "failed", message: describeError(error) };
	}

	return { kind: "written", note, day };
}

/** Works out and writes the day of a single note. */
export async function updateDailyNote(
	host: NutritionHost,
	note: DailyNote,
): Promise<NutritionOutcome> {
	return updateNote(host, note, host.records());
}

/**
 * Goes through every daily note of the vault. The records are read once and
 * grouped by day, so that a vault of a thousand days does not walk its records
 * a thousand times over.
 */
export async function updateAllDailyNotes(host: NutritionHost): Promise<NutritionRunSummary> {
	const days = recordsByDay(host.records());
	const notes = host.dailyNotes();
	const summary: NutritionRunSummary = { notes: notes.length, written: 0, failures: [] };

	for (const note of notes) {
		const outcome = await updateNote(host, note, days.get(note.date) ?? []);

		if (outcome.kind === "written") {
			summary.written += 1;
		} else if (outcome.kind === "failed") {
			summary.failures.push({ note: note.path, message: outcome.message });
		}
	}

	return summary;
}

/** The totals of a day, written out the way a notice shows them. */
export function describeNutrients(totals: Nutrients): string {
	return (
		`${totals.calories} kcal, ${totals.protein} protein, ${totals.fat} fat, ` +
		`${totals.carbs} carbs, ${totals.water} water`
	);
}

/** Turns the outcome of a single note into the line a notice shows. */
export function describeNutritionOutcome(outcome: NutritionOutcome): string {
	switch (outcome.kind) {
		case "not-configured":
			return "No nutrition records folder is set. Add one in the settings of the plugin.";
		case "failed":
			return `Nothing was written: ${outcome.message}`;
		case "unchanged":
		case "written": {
			const { day, note } = outcome;
			const counted = `${day.counted} ${day.counted === 1 ? "record" : "records"}`;
			const broken =
				day.unresolved.length === 0
					? ""
					: `, ${day.unresolved.length} unknown (${day.unresolved.join(", ")})`;
			const state = outcome.kind === "written" ? "Wrote" : "Unchanged:";

			return `${state} ${describeNutrients(day.totals)} for ${note.date}, from ${counted}${broken}.`;
		}
	}
}

/** Turns the outcome of a run over the whole vault into one line. */
export function describeNutritionRun(summary: NutritionRunSummary): string {
	const notes = `${summary.notes} daily ${summary.notes === 1 ? "note" : "notes"}`;
	const line = `Nutrition: ${summary.written} of ${notes} updated`;

	return summary.failures.length === 0
		? `${line}.`
		: `${line}, ${summary.failures.length} left alone (see the console).`;
}
