/*
 * Summing up what was eaten on a day.
 *
 * The numbers have to come out exactly like the ones the "Питание" base shows
 * under its "День" view, so the two calculations are kept side by side here:
 *
 *   formula: (product.calories / product.unit_size * quantity).round()
 *   summary: values.filter(value.isType("number")).reduce(acc + value, 0)
 *
 * That is: every record is worked out and rounded on its own, and the rounded
 * amounts are added up afterwards. Rounding the sum instead would drift away
 * from the base by a unit or two on a busy day.
 */

/** The nutrients a record contributes, in the order they are reported in. */
export const NUTRIENTS = ["calories", "protein", "fat", "carbs", "water"] as const;

/** One of the nutrients the plugin knows about. */
export type Nutrient = (typeof NUTRIENTS)[number];

/** An amount of every nutrient, as eaten over a day or in one sitting. */
export type Nutrients = Record<Nutrient, number>;

/** The properties a record note carries, reduced to what the sum needs. */
export interface NutritionRecord {
	/** Vault path of the record, used to resolve its product link. */
	path: string;
	/** `date` as `YYYY-MM-DD`, or `null` when it is missing or unreadable. */
	date: string | null;
	/** Link target of `product`, without its alias and subpath. */
	product: string | null;
	/** `quantity` as a number, or `null` when it is missing or unreadable. */
	quantity: number | null;
}

/** What a product note states about one `unitSize` of the product. */
export interface ProductFacts extends Record<Nutrient, number | null> {
	/** `unit_size`, the amount the nutrients are given for. */
	unitSize: number | null;
}

/** The outcome of summing up one day. */
export interface DayNutrition {
	/** The totals, worked out the way the base works them out. */
	totals: Nutrients;
	/** How many records of that day were counted. */
	counted: number;
	/** Product links of that day that point at no note, without repeats. */
	unresolved: string[];
}

/** A day with nothing eaten on it. */
export function noNutrients(): Nutrients {
	return { calories: 0, protein: 0, fat: 0, carbs: 0, water: 0 };
}

/** Whether the two sets of amounts hold the same numbers. */
export function sameNutrients(one: Nutrients, other: Nutrients): boolean {
	return NUTRIENTS.every((nutrient) => one[nutrient] === other[nutrient]);
}

/**
 * Reads a frontmatter value as a number. Obsidian hands numeric properties over
 * as numbers, but a property that was typed as text still holds a number worth
 * counting, so both are accepted.
 */
export function readNumber(value: unknown): number | null {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}

	if (typeof value !== "string" || value.trim() === "") {
		return null;
	}

	const parsed = Number(value.trim());

	return Number.isFinite(parsed) ? parsed : null;
}

function twoDigits(value: number): string {
	return value.toString().padStart(2, "0");
}

/**
 * Reads a frontmatter value as a day. A date property arrives as a string, but
 * YAML may also have turned it into a `Date` already, in which case the day it
 * was written as is the one in UTC.
 */
export function readDate(value: unknown): string | null {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime())
			? null
			: `${value.getUTCFullYear()}-${twoDigits(value.getUTCMonth() + 1)}-` +
					twoDigits(value.getUTCDate());
	}

	if (typeof value !== "string") {
		return null;
	}

	// A day may carry a time behind it; only the day itself is compared.
	const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());

	return match === null ? null : match[1];
}

/**
 * Reads a frontmatter value as the note a link points at: `[[Note|Alias]]`
 * names `Note`, and so does a bare `Note`. A heading or block behind the name
 * belongs to the link, not to the note, and is dropped.
 */
export function readLinkTarget(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const wikilink = /^\s*\[\[(.*)\]\]\s*$/.exec(value);
	const inner = (wikilink === null ? value : wikilink[1]).split("|")[0];
	const target = inner.split("#")[0].split("^")[0].trim();

	return target === "" ? null : target;
}

/**
 * What one record adds to the day: the facts of its product scaled to the
 * amount that was eaten, rounded per nutrient the way the base rounds its
 * columns. A nutrient that cannot be worked out adds nothing.
 */
export function recordAmounts(record: NutritionRecord, facts: ProductFacts): Nutrients {
	const amounts = noNutrients();

	if (record.quantity === null || facts.unitSize === null || facts.unitSize === 0) {
		return amounts;
	}

	for (const nutrient of NUTRIENTS) {
		const stated = facts[nutrient];

		if (stated === null) {
			continue;
		}

		const amount = Math.round((stated / facts.unitSize) * record.quantity);

		if (Number.isFinite(amount)) {
			amounts[nutrient] = amount;
		}
	}

	return amounts;
}

/**
 * Sums up the records of one day, the way the "День" view of the base does:
 * every record whose `date` is that day takes part, whichever note it sits in.
 */
export function sumDay(
	date: string,
	records: NutritionRecord[],
	factsOf: (record: NutritionRecord) => ProductFacts | null,
): DayNutrition {
	const totals = noNutrients();
	const unresolved: string[] = [];
	let counted = 0;

	for (const record of records) {
		if (record.date !== date) {
			continue;
		}

		counted += 1;

		const facts = record.product === null ? null : factsOf(record);

		if (facts === null) {
			if (record.product !== null && !unresolved.includes(record.product)) {
				unresolved.push(record.product);
			}

			continue;
		}

		const amounts = recordAmounts(record, facts);

		for (const nutrient of NUTRIENTS) {
			totals[nutrient] += amounts[nutrient];
		}
	}

	return { totals, counted, unresolved };
}

/** Groups records by the day they belong to, so that a run can go day by day. */
export function recordsByDay(records: NutritionRecord[]): Map<string, NutritionRecord[]> {
	const days = new Map<string, NutritionRecord[]>();

	for (const record of records) {
		if (record.date === null) {
			continue;
		}

		const day = days.get(record.date);

		if (day === undefined) {
			days.set(record.date, [record]);
		} else {
			day.push(record);
		}
	}

	return days;
}
