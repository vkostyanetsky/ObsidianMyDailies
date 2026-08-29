/*
 * Nutrition as a metric of a daily note: what was eaten on the day the note
 * stands for.
 *
 * The property names the records and the products themselves use are fixed
 * here; only the properties the totals end up in are the user's to name.
 */

import type { App, TFile } from "obsidian";
import { TFile as ObsidianFile } from "obsidian";

import { frontmatterOf } from "../daily-notes/vault-host";
import type { DayMetric, DayMetricSource, MetricValues } from "../daily-notes/metrics";
import { log } from "../log";
import { isInFolder, normalizeFolder } from "../settings/settings";
import type { MyDailiesSettings } from "../settings/settings";
import type { NutritionRecord, ProductFacts } from "./totals";
import { NUTRIENTS, readDate, readLinkTarget, readNumber, recordsByDay, sumDay } from "./totals";

/** The property a record states the day it belongs to in. */
const RECORD_DATE = "date";
/** The property a record links its product in. */
const RECORD_PRODUCT = "product";
/** The property a record states how much was eaten in. */
const RECORD_QUANTITY = "quantity";
/** The property a product states what its nutrients are given for in. */
const PRODUCT_UNIT_SIZE = "unit_size";

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

/** Reads the records of the folder and groups them by the day they belong to. */
function openMetric(app: App, settings: MyDailiesSettings, recordsFolder: string): DayMetric {
	const records = app.vault
		.getMarkdownFiles()
		.filter((file) => isInFolder(file.path, recordsFolder))
		.map((file) => readRecord(app, file));
	const days = recordsByDay(records);

	log(`nutrition: read ${records.length} records from "${recordsFolder}"`);

	// A product is read once per run, however many records point at it.
	const products = new Map<string, ProductFacts>();
	const factsOf = (record: NutritionRecord): ProductFacts | null => {
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
	};

	return {
		measure: (note) => {
			const day = sumDay(note.date, days.get(note.date) ?? [], factsOf);
			const values: MetricValues = {};

			for (const nutrient of NUTRIENTS) {
				values[settings.nutrition.properties[nutrient]] = day.totals[nutrient];
			}

			const counted = `${day.counted} ${day.counted === 1 ? "record" : "records"}`;
			const broken =
				day.unresolved.length === 0
					? ""
					: `, ${day.unresolved.length} unknown (${day.unresolved.join(", ")})`;

			return {
				values,
				summary:
					`${day.totals.calories} kcal, ${day.totals.protein} protein, ` +
					`${day.totals.fat} fat, ${day.totals.carbs} carbs, ` +
					`${day.totals.water} water from ${counted}${broken}`,
			};
		},
	};
}

/**
 * The nutrition metric, or `null` when it is switched off or has no records
 * folder to read and therefore nothing to sum up.
 */
export function createNutritionMetric(
	app: App,
	settings: MyDailiesSettings,
): DayMetricSource | null {
	const recordsFolder = normalizeFolder(settings.nutrition.recordsFolder);

	if (!settings.nutrition.enabled || recordsFolder === "") {
		return null;
	}

	return {
		id: "nutrition",
		properties: NUTRIENTS.map((nutrient) => settings.nutrition.properties[nutrient]),
		open: () => openMetric(app, settings, recordsFolder),
	};
}
