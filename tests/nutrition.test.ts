import { describe, expect, it } from "vitest";

import { setFrontmatterValues } from "../src/markdown/frontmatter";
import type { NutritionRecord, ProductFacts } from "../src/nutrition/totals";
import {
	readDate,
	readLinkTarget,
	readNumber,
	recordAmounts,
	recordsByDay,
	sumDay,
} from "../src/nutrition/totals";
import { readSettings, DEFAULT_SETTINGS } from "../src/settings/settings";

/** A product note stating its facts per 100 units, as most of them do. */
function product(facts: Partial<ProductFacts>): ProductFacts {
	return {
		unitSize: 100,
		calories: null,
		protein: null,
		fat: null,
		carbs: null,
		water: null,
		...facts,
	};
}

function record(fields: Partial<NutritionRecord>): NutritionRecord {
	return { path: "Records/1.md", date: "2026-08-27", product: "Bread", quantity: 100, ...fields };
}

describe("readNumber", () => {
	it("takes a number as it is", () => {
		expect(readNumber(120.3)).toBe(120.3);
	});

	it("takes a number that was typed as text", () => {
		expect(readNumber(" 148 ")).toBe(148);
	});

	it("refuses what is not a number", () => {
		expect(readNumber(undefined)).toBeNull();
		expect(readNumber("")).toBeNull();
		expect(readNumber("a lot")).toBeNull();
		expect(readNumber(Number.NaN)).toBeNull();
	});
});

describe("readDate", () => {
	it("reads a day written as text", () => {
		expect(readDate("2025-11-17")).toBe("2025-11-17");
	});

	it("drops a time behind the day", () => {
		expect(readDate("2025-11-17T08:30:00")).toBe("2025-11-17");
	});

	it("reads a day YAML has already turned into a date", () => {
		expect(readDate(new Date("2025-11-17T00:00:00Z"))).toBe("2025-11-17");
	});

	it("refuses anything that is not a day", () => {
		expect(readDate("November")).toBeNull();
		expect(readDate(17)).toBeNull();
	});
});

describe("readLinkTarget", () => {
	it("reads a plain wikilink", () => {
		expect(readLinkTarget("[[Пирог с рыбой]]")).toBe("Пирог с рыбой");
	});

	it("drops the alias of a link", () => {
		expect(readLinkTarget("[[Горбуша рубленая|Рубленая горбуша]]")).toBe("Горбуша рубленая");
	});

	it("drops a heading or block behind the note", () => {
		expect(readLinkTarget("[[Bread#Facts]]")).toBe("Bread");
		expect(readLinkTarget("[[Bread^abc123]]")).toBe("Bread");
	});

	it("takes a note that is named without brackets", () => {
		expect(readLinkTarget(" Bread ")).toBe("Bread");
	});

	it("refuses an empty or missing link", () => {
		expect(readLinkTarget("[[]]")).toBeNull();
		expect(readLinkTarget(undefined)).toBeNull();
	});
});

describe("recordAmounts", () => {
	it("scales the facts to the amount that was eaten", () => {
		const amounts = recordAmounts(
			record({ quantity: 148 }),
			product({ calories: 120.3, protein: 10, fat: 4.5, carbs: 10.2, water: 0 }),
		);

		// 120.3 / 100 * 148 = 178.044, and so on, each rounded on its own.
		expect(amounts).toEqual({ calories: 178, protein: 15, fat: 7, carbs: 15, water: 0 });
	});

	it("counts a product that is stated per piece", () => {
		const amounts = recordAmounts(
			record({ quantity: 2 }),
			product({ unitSize: 1, calories: 72, protein: 6 }),
		);

		expect(amounts.calories).toBe(144);
		expect(amounts.protein).toBe(12);
	});

	it("adds nothing for a nutrient the product does not state", () => {
		expect(recordAmounts(record({}), product({ calories: 50 })).protein).toBe(0);
	});

	it("adds nothing when there is no amount or no unit size", () => {
		expect(recordAmounts(record({ quantity: null }), product({ calories: 50 })).calories).toBe(
			0,
		);
		expect(recordAmounts(record({}), product({ unitSize: 0, calories: 50 })).calories).toBe(0);
		expect(recordAmounts(record({}), product({ unitSize: null, calories: 50 })).calories).toBe(
			0,
		);
	});
});

describe("sumDay", () => {
	const bread = product({ calories: 120.3, protein: 10, fat: 4.5, carbs: 10.2, water: 0 });
	const water = product({ calories: 0, protein: 0, fat: 0, carbs: 0, water: 100 });
	const facts = (entry: NutritionRecord): ProductFacts | null => {
		if (entry.product === "Bread") {
			return bread;
		}

		return entry.product === "Water" ? water : null;
	};

	it("adds up the amounts each of which was rounded on its own", () => {
		// 12.5 / 100 * 100 = 12.5 → 13 twice over is 26, where the exact sum of
		// 25 would have been reported as 25. The base rounds per record, so 26
		// is the number that has to come out here as well.
		const halves = product({ calories: 12.5 });
		const day = sumDay(
			"2026-08-27",
			[record({ product: "Halves" }), record({ path: "Records/2.md", product: "Halves" })],
			() => halves,
		);

		expect(day.totals.calories).toBe(26);
		expect(day.counted).toBe(2);
	});

	it("leaves the records of other days out", () => {
		const day = sumDay(
			"2026-08-27",
			[record({ quantity: 100 }), record({ path: "Records/2.md", date: "2026-08-26" })],
			facts,
		);

		expect(day.counted).toBe(1);
		expect(day.totals.calories).toBe(120);
	});

	it("counts water alongside the rest", () => {
		const day = sumDay("2026-08-27", [record({ product: "Water", quantity: 350 })], facts);

		expect(day.totals.water).toBe(350);
		expect(day.totals.calories).toBe(0);
	});

	it("reports a product that no note answers to, once", () => {
		const day = sumDay(
			"2026-08-27",
			[record({ product: "Ambrosia" }), record({ path: "Records/2.md", product: "Ambrosia" })],
			facts,
		);

		expect(day.unresolved).toEqual(["Ambrosia"]);
		expect(day.counted).toBe(2);
		expect(day.totals.calories).toBe(0);
	});

	it("comes out empty for a day nothing was eaten on", () => {
		const day = sumDay("2026-08-24", [record({})], facts);

		expect(day.counted).toBe(0);
		expect(day.totals).toEqual({ calories: 0, protein: 0, fat: 0, carbs: 0, water: 0 });
	});
});

describe("recordsByDay", () => {
	it("groups the records and drops the ones without a day", () => {
		const days = recordsByDay([
			record({ path: "a.md" }),
			record({ path: "b.md", date: "2026-08-26" }),
			record({ path: "c.md", date: null }),
		]);

		expect([...days.keys()].sort()).toEqual(["2026-08-26", "2026-08-27"]);
		expect(days.get("2026-08-27")).toHaveLength(1);
	});
});

describe("setFrontmatterValues", () => {
	const totals = [
		{ key: "calories", value: "1387" },
		{ key: "water", value: "1600" },
	];

	it("replaces the properties that are already there", () => {
		const note = "---\nweight:\ncalories: 12\nwater: 0\n---\n\nBody\n";

		expect(setFrontmatterValues(note, totals)).toBe(
			"---\nweight:\ncalories: 1387\nwater: 1600\n---\n\nBody\n",
		);
	});

	it("appends the properties that are missing, leaving the rest alone", () => {
		const note = "---\nweight:\nsteps:\ngym:\ntimestamp: 1755706724\n---\n\nBody\n";

		expect(setFrontmatterValues(note, totals)).toBe(
			"---\nweight:\nsteps:\ngym:\ntimestamp: 1755706724\n" +
				"calories: 1387\nwater: 1600\n---\n\nBody\n",
		);
	});

	it("says nothing has to be written when the note already reads that way", () => {
		const note = "---\ncalories: 1387\nwater: 1600\n---\n\nBody\n";

		expect(setFrontmatterValues(note, totals)).toBeNull();
	});

	it("replaces a value that spans several lines", () => {
		const note = "---\ncalories:\n  - 1\n  - 2\nwater: 1600\nafter: yes\n---\n";

		expect(setFrontmatterValues(note, totals)).toBe(
			"---\ncalories: 1387\nwater: 1600\nafter: yes\n---\n",
		);
	});

	it("leaves a property of a nested value alone", () => {
		const note = "---\nnested:\n  calories: 5\nwater: 1600\n---\n";

		expect(setFrontmatterValues(note, totals)).toBe(
			"---\nnested:\n  calories: 5\nwater: 1600\ncalories: 1387\n---\n",
		);
	});

	it("adds a block to a note that has none", () => {
		expect(setFrontmatterValues("Body\n", totals)).toBe(
			"---\ncalories: 1387\nwater: 1600\n---\n\nBody\n",
		);
	});

	it("adds a block to an empty note", () => {
		expect(setFrontmatterValues("", totals)).toBe("---\ncalories: 1387\nwater: 1600\n---\n");
	});

	it("keeps the line breaks of a note that uses Windows ones", () => {
		const note = "---\r\ncalories: 0\r\n---\r\n\r\nBody\r\n";

		expect(setFrontmatterValues(note, totals)).toBe(
			"---\r\ncalories: 1387\r\nwater: 1600\r\n---\r\n\r\nBody\r\n",
		);
	});

	it("writes a block of its own when the one at the top is never closed", () => {
		expect(setFrontmatterValues("---\ncalories: 1\n", totals)).toBe(
			"---\ncalories: 1387\nwater: 1600\n---\n\n---\ncalories: 1\n",
		);
	});
});

describe("readSettings", () => {
	it("keeps the nutrition settings that were stored", () => {
		const settings = readSettings({
			nutrition: {
				enabled: true,
				recordsFolder: "Records",
				properties: { calories: "ккал", fat: " жиры " },
			},
		});

		expect(settings.nutrition.enabled).toBe(true);
		expect(settings.nutrition.recordsFolder).toBe("Records");
		expect(settings.nutrition.properties.calories).toBe("ккал");
		expect(settings.nutrition.properties.fat).toBe("жиры");
		expect(settings.nutrition.properties.protein).toBe("protein");
	});

	it("falls back to the default for a property that names nothing", () => {
		const settings = readSettings({ nutrition: { properties: { water: "   " } } });

		expect(settings.nutrition.properties.water).toBe("water");
	});

	it("fills in everything an older installation never stored", () => {
		const settings = readSettings({ autoUpdateNutrition: false });

		expect(settings.dailyNotes).toEqual(DEFAULT_SETTINGS.dailyNotes);
		expect(settings.nutrition).toEqual(DEFAULT_SETTINGS.nutrition);
		expect(settings.openTasks).toEqual(DEFAULT_SETTINGS.openTasks);
	});

	it("carries the nutrition settings over from where they used to sit", () => {
		// They were flat at the top before there was more than one thing to
		// count, and an installation set up back then must keep its folders.
		const settings = readSettings({
			nutritionRecordsFolder: "Области/Здоровье/Питание/Записи",
			dailyNotesFolder: "Области/Задачи/Дни",
			nutritionProperties: { calories: "ккал" },
			autoUpdateNutrition: true,
		});

		expect(settings.nutrition.recordsFolder).toBe("Области/Здоровье/Питание/Записи");
		expect(settings.dailyNotes.folder).toBe("Области/Задачи/Дни");
		expect(settings.dailyNotes.autoUpdate).toBe(true);
		expect(settings.nutrition.properties.calories).toBe("ккал");
	});

	it("counts a records folder of back then as the metric having been on", () => {
		expect(readSettings({ nutritionRecordsFolder: "Records" }).nutrition.enabled).toBe(true);
		expect(readSettings({ nutritionRecordsFolder: "" }).nutrition.enabled).toBe(false);
		expect(readSettings({}).nutrition.enabled).toBe(false);
	});

	it("lets the nested settings win over the ones they replaced", () => {
		const settings = readSettings({
			nutritionRecordsFolder: "Old",
			nutrition: { enabled: false, recordsFolder: "New" },
		});

		expect(settings.nutrition.recordsFolder).toBe("New");
		expect(settings.nutrition.enabled).toBe(false);
	});
});
