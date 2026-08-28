import { describe, expect, it } from "vitest";

import { setFrontmatterValues } from "../src/markdown/frontmatter";
import { dailyNoteDate, isInDailyNotesFolder } from "../src/nutrition/daily-notes";
import type { NutritionRecord, ProductFacts } from "../src/nutrition/totals";
import {
	readDate,
	readLinkTarget,
	readNumber,
	recordAmounts,
	recordsByDay,
	sameNutrients,
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

describe("sameNutrients", () => {
	const totals = { calories: 1, protein: 2, fat: 3, carbs: 4, water: 5 };

	it("sees two equal sets", () => {
		expect(sameNutrients(totals, { ...totals })).toBe(true);
	});

	it("sees a difference in any nutrient", () => {
		expect(sameNutrients(totals, { ...totals, water: 6 })).toBe(false);
	});

	it("never counts a value the note does not carry as equal", () => {
		expect(sameNutrients(totals, { ...totals, fat: Number.NaN })).toBe(false);
	});
});

describe("dailyNoteDate", () => {
	it("reads the day a note is named after", () => {
		expect(dailyNoteDate("2026-08-28")).toBe("2026-08-28");
	});

	it("refuses a note that is not named after a day", () => {
		expect(dailyNoteDate("2023-11-09 Дорожная карта.excalidraw")).toBeNull();
		expect(dailyNoteDate("Питание")).toBeNull();
		expect(dailyNoteDate("2026-08-28-1")).toBeNull();
	});

	it("refuses a day there is no such thing as", () => {
		expect(dailyNoteDate("2026-02-30")).toBeNull();
		expect(dailyNoteDate("2026-13-01")).toBeNull();
		expect(dailyNoteDate("2026-00-10")).toBeNull();
	});

	it("takes the leap day of a leap year and refuses it otherwise", () => {
		expect(dailyNoteDate("2024-02-29")).toBe("2024-02-29");
		expect(dailyNoteDate("2026-02-29")).toBeNull();
	});
});

describe("isInDailyNotesFolder", () => {
	it("holds a note of the folder", () => {
		expect(isInDailyNotesFolder("Days/2026-08-28.md", "Days")).toBe(true);
	});

	it("leaves a note of another folder out", () => {
		expect(isInDailyNotesFolder("Notes/2026-08-28.md", "Days")).toBe(false);
	});

	it("takes the whole vault when no folder is named", () => {
		expect(isInDailyNotesFolder("2026-08-28.md", "")).toBe(true);
		expect(isInDailyNotesFolder("Notes/2026-08-28.md", " ")).toBe(true);
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
	it("fills in the nutrition settings of an older installation", () => {
		const settings = readSettings({ imageFolders: ["Notes"], autoRenameImages: true });

		expect(settings.nutritionRecordsFolder).toBe("");
		expect(settings.dailyNotesFolder).toBe("");
		expect(settings.autoUpdateNutrition).toBe(false);
		expect(settings.nutritionProperties).toEqual(DEFAULT_SETTINGS.nutritionProperties);
	});

	it("keeps the property names that were stored", () => {
		const settings = readSettings({ nutritionProperties: { calories: "ккал", fat: " жиры " } });

		expect(settings.nutritionProperties.calories).toBe("ккал");
		expect(settings.nutritionProperties.fat).toBe("жиры");
		expect(settings.nutritionProperties.protein).toBe("protein");
	});

	it("falls back to the default for a property that names nothing", () => {
		const settings = readSettings({ nutritionProperties: { water: "   " } });

		expect(settings.nutritionProperties.water).toBe("water");
	});
});
