import { describe, expect, it } from "vitest";

import type { MonthDaysHost } from "../src/monthly-notes/days";
import {
	createMonthDays,
	dailyNotePath,
	describeMonthDaysRun,
} from "../src/monthly-notes/days";
import { monthlyNoteFormat } from "../src/navigation/dashboard";
import { daysOfMonth } from "../src/navigation/dates";

/**
 * A vault that only knows which notes it holds. Whatever is created lands in
 * the same set, so a run cannot create the same note twice unnoticed.
 */
function vault(paths: string[], failing: string[] = []): MonthDaysHost & { notes: Set<string> } {
	const notes = new Set(paths);

	return {
		notes,
		hasNote: (path) => notes.has(path),
		createNote: async (path) => {
			if (failing.includes(path)) {
				throw new Error("the folder is read-only");
			}

			notes.add(path);
		},
	};
}

describe("the days of a month", () => {
	it("runs from the first day to the last", () => {
		const days = daysOfMonth("2026-08");

		expect(days).toHaveLength(31);
		expect(days[0]).toBe("2026-08-01");
		expect(days[30]).toBe("2026-08-31");
	});

	it("gives February the days that year has", () => {
		expect(daysOfMonth("2026-02")).toHaveLength(28);
		expect(daysOfMonth("2024-02")).toHaveLength(29);
	});

	it("crosses no month, however long the month is", () => {
		expect(daysOfMonth("2026-09")).toHaveLength(30);
		expect(daysOfMonth("2026-12").at(-1)).toBe("2026-12-31");
	});

	it("gives no days at all to something that names no month", () => {
		expect(daysOfMonth("2026-13")).toEqual([]);
		expect(daysOfMonth("nothing")).toEqual([]);
	});
});

describe("monthlyNoteFormat", () => {
	it("quotes what stands outside the braces and keeps what stands inside", () => {
		expect(monthlyNoteFormat("Month {YYYY-MM}")).toBe("[Month ]YYYY-MM");
		expect(monthlyNoteFormat("{MMMM YYYY}")).toBe("MMMM YYYY");
		expect(monthlyNoteFormat("Отчёт за {MMMM YYYY}")).toBe("[Отчёт за ]MMMM YYYY");
	});

	it("reads a name the way the very same template writes it", () => {
		// What comes out has to be a format of Moment's; that it reads
		// `Month 2026-08` back is what the plugin then asks Moment for.
		expect(monthlyNoteFormat("{YYYY} — {MM}")).toBe("YYYY[ — ]MM");
	});

	it("treats empty braces as the name they are", () => {
		expect(monthlyNoteFormat("Month {}")).toBe("[Month ][{}]");
	});

	it("falls back to the default template when none is given", () => {
		expect(monthlyNoteFormat("   ")).toBe("[Month ]YYYY-MM");
	});
});

describe("dailyNotePath", () => {
	it("puts the note of a day in the folder of the daily notes", () => {
		expect(dailyNotePath("Days", "2026-08-29")).toBe("Days/2026-08-29.md");
	});

	it("puts it in the vault root when no folder is named", () => {
		expect(dailyNotePath("", "2026-08-29")).toBe("2026-08-29.md");
	});
});

describe("createMonthDays", () => {
	it("gives every day of the month a note of its own", async () => {
		const host = vault([]);
		const summary = await createMonthDays(host, "2026-08", "Days");

		expect(summary).toEqual({ month: "2026-08", days: 31, created: 31, failures: [] });
		expect(host.notes.has("Days/2026-08-01.md")).toBe(true);
		expect(host.notes.has("Days/2026-08-31.md")).toBe(true);
		expect(host.notes.size).toBe(31);
	});

	it("leaves the days that already have one alone", async () => {
		const host = vault(["Days/2026-08-01.md", "Days/2026-08-15.md"]);
		const summary = await createMonthDays(host, "2026-08", "Days");

		expect(summary.created).toBe(29);
		expect(summary.days).toBe(31);
		expect(host.notes.size).toBe(31);
	});

	it("creates nothing twice over", async () => {
		const host = vault([]);

		await createMonthDays(host, "2026-08", "Days");

		expect((await createMonthDays(host, "2026-08", "Days")).created).toBe(0);
	});

	it("carries on past a day it could not write, and reports it", async () => {
		const host = vault([], ["Days/2026-08-02.md"]);
		const summary = await createMonthDays(host, "2026-08", "Days");

		expect(summary.created).toBe(30);
		expect(summary.failures).toEqual([
			{ note: "Days/2026-08-02.md", message: "the folder is read-only" },
		]);
	});

	it("writes nothing for something that names no month", async () => {
		const host = vault([]);
		const summary = await createMonthDays(host, "2026-13", "Days");

		expect(summary).toEqual({ month: "2026-13", days: 0, created: 0, failures: [] });
		expect(host.notes.size).toBe(0);
	});
});

describe("describeMonthDaysRun", () => {
	it("says how many of the days were given a note", () => {
		expect(
			describeMonthDaysRun({ month: "2026-08", days: 31, created: 29, failures: [] }),
		).toBe("2026-08: 29 of 31 days created.");
	});

	it("points at the console when a day was left alone", () => {
		expect(
			describeMonthDaysRun({
				month: "2026-08",
				days: 31,
				created: 30,
				failures: [{ note: "Days/2026-08-02.md", message: "read-only" }],
			}),
		).toBe("2026-08: 30 of 31 days created, 1 left alone (see the console).");
	});

	it("says as much when there was nothing left to create", () => {
		expect(
			describeMonthDaysRun({ month: "2026-08", days: 31, created: 0, failures: [] }),
		).toBe("2026-08: every one of its 31 days already has a note.");
	});

	it("says as much when the month is no month", () => {
		expect(
			describeMonthDaysRun({ month: "2026-13", days: 0, created: 0, failures: [] }),
		).toBe("2026-13 does not name a month.");
	});
});
