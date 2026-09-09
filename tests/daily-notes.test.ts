import { describe, expect, it } from "vitest";

import type {
	DailyNote,
	DailyNotesHost,
	DailyNotesRunSummary,
	DayMetricSource,
	MetricValues,
} from "../src/daily-notes/metrics";
import {
	clashingProperties,
	describeDailyNoteOutcome,
	describeDailyNotesRun,
	updateAllDailyNotes,
	updateDailyNote,
} from "../src/daily-notes/metrics";
import { dailyNoteDate, isInDailyNotesFolder } from "../src/daily-notes/notes";

/** A metric that answers with the same values for every note. */
function metric(id: string, values: MetricValues, summary = id): DayMetricSource {
	return {
		id,
		properties: Object.keys(values),
		open: () => ({ measure: () => ({ values, summary }) }),
	};
}

/** A vault of daily notes held in memory, with what they already say. */
function host(notes: Record<string, string>): DailyNotesHost & { written: Record<string, string> } {
	const written: Record<string, string> = {};

	return {
		written,
		dailyNotes: () =>
			Object.keys(notes).map((date) => ({ path: `Days/${date}.md`, date })),
		storedValues: (note, properties) => {
			const source = notes[note.date];
			const stored: Record<string, string | null> = {};

			for (const property of properties) {
				const match = new RegExp(`^${property}: (.*)$`, "m").exec(source);

				stored[property] = match === null ? null : match[1];
			}

			return stored;
		},
		updateNote: async (note, update) => {
			const updated = update(notes[note.date]);

			if (updated !== null) {
				notes[note.date] = updated;
				written[note.date] = updated;
			}
		},
	};
}

const NOTE: DailyNote = { path: "Days/2026-08-27.md", date: "2026-08-27" };

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

describe("clashingProperties", () => {
	it("sees nothing wrong when every metric has its own properties", () => {
		expect(clashingProperties([metric("a", { calories: 1 }), metric("b", { tasks: 2 })])).toEqual(
			[],
		);
	});

	it("names a property two metrics claim", () => {
		expect(clashingProperties([metric("a", { count: 1 }), metric("b", { count: 2 })])).toEqual([
			"count",
		]);
	});

	it("names each clashing property once, however many claim it", () => {
		expect(
			clashingProperties([
				metric("a", { count: 1 }),
				metric("b", { count: 2 }),
				metric("c", { count: 3 }),
			]),
		).toEqual(["count"]);
	});
});

describe("updateDailyNote", () => {
	it("writes the properties of every metric in one go", async () => {
		const vault = host({ "2026-08-27": "---\nweight:\n---\n\nBody\n" });
		const outcome = await updateDailyNote(
			vault,
			[metric("nutrition", { calories: 1387 }), metric("tasks", { tasks: 3 })],
			NOTE,
		);

		expect(outcome.kind).toBe("written");
		expect(vault.written["2026-08-27"]).toBe(
			"---\nweight:\ncalories: 1387\ntasks: 3\n---\n\nBody\n",
		);
	});

	it("writes nothing when the note already says all of it", async () => {
		const vault = host({ "2026-08-27": "---\ncalories: 1387\ntasks: 3\n---\n" });
		const outcome = await updateDailyNote(
			vault,
			[metric("nutrition", { calories: 1387 }), metric("tasks", { tasks: 3 })],
			NOTE,
		);

		expect(outcome.kind).toBe("unchanged");
		expect(vault.written).toEqual({});
	});

	it("writes when a single metric of several has moved", async () => {
		const vault = host({ "2026-08-27": "---\ncalories: 1387\ntasks: 2\n---\n" });
		const outcome = await updateDailyNote(
			vault,
			[metric("nutrition", { calories: 1387 }), metric("tasks", { tasks: 3 })],
			NOTE,
		);

		expect(outcome.kind).toBe("written");
		expect(vault.written["2026-08-27"]).toBe("---\ncalories: 1387\ntasks: 3\n---\n");
	});

	it("writes when the note does not carry a property at all", async () => {
		const vault = host({ "2026-08-27": "---\ncalories: 1387\n---\n" });

		expect(
			(await updateDailyNote(vault, [metric("tasks", { tasks: 0 })], NOTE)).kind,
		).toBe("written");
	});

	it("refuses to write when two metrics claim the same property", async () => {
		const vault = host({ "2026-08-27": "---\n---\n" });
		const outcome = await updateDailyNote(
			vault,
			[metric("a", { count: 1 }), metric("b", { count: 2 })],
			NOTE,
		);

		expect(outcome).toEqual({ kind: "clashing-properties", properties: ["count"] });
		expect(vault.written).toEqual({});
	});

	it("says so when nothing is switched on", async () => {
		const vault = host({ "2026-08-27": "---\n---\n" });

		expect((await updateDailyNote(vault, [], NOTE)).kind).toBe("nothing-to-count");
	});

	it("reports a note that could not be written", async () => {
		const vault = host({ "2026-08-27": "---\n---\n" });
		vault.updateNote = () => Promise.reject(new Error("it was changed underneath"));

		expect(await updateDailyNote(vault, [metric("tasks", { tasks: 3 })], NOTE)).toEqual({
			kind: "failed",
			message: "it was changed underneath",
		});
	});
});

describe("updateAllDailyNotes", () => {
	it("counts only the notes it actually wrote", async () => {
		const vault = host({
			"2026-08-26": "---\ntasks: 3\n---\n",
			"2026-08-27": "---\ntasks: 0\n---\n",
			"2026-08-28": "---\n---\n",
		});
		const summary = (await updateAllDailyNotes(vault, [
			metric("tasks", { tasks: 3 }),
		])) as DailyNotesRunSummary;

		expect(summary).toEqual({ notes: 3, written: 2, failures: [] });
		expect(Object.keys(vault.written).sort()).toEqual(["2026-08-27", "2026-08-28"]);
	});

	it("keeps going after a note it could not write", async () => {
		const vault = host({ "2026-08-26": "---\n---\n", "2026-08-27": "---\n---\n" });
		const update = vault.updateNote.bind(vault);

		vault.updateNote = (note, edit) =>
			note.date === "2026-08-26"
				? Promise.reject(new Error("locked"))
				: update(note, edit);

		const summary = (await updateAllDailyNotes(vault, [
			metric("tasks", { tasks: 3 }),
		])) as DailyNotesRunSummary;

		expect(summary.written).toBe(1);
		expect(summary.failures).toEqual([{ note: "Days/2026-08-26.md", message: "locked" }]);
	});

	it("refuses the whole run when two metrics claim the same property", async () => {
		const vault = host({ "2026-08-27": "---\n---\n" });

		expect(
			await updateAllDailyNotes(vault, [metric("a", { count: 1 }), metric("b", { count: 2 })]),
		).toEqual({ kind: "clashing-properties", properties: ["count"] });
	});
});

describe("describeDailyNoteOutcome", () => {
	it("joins what every metric had to say", () => {
		expect(
			describeDailyNoteOutcome({
				kind: "written",
				note: NOTE,
				summaries: ["1387 kcal from 5 records", "3 open tasks"],
			}),
		).toBe("Wrote 2026-08-27: 1387 kcal from 5 records; 3 open tasks.");
	});

	it("says a note was left as it was", () => {
		expect(
			describeDailyNoteOutcome({ kind: "unchanged", note: NOTE, summaries: ["3 open tasks"] }),
		).toBe("Unchanged 2026-08-27: 3 open tasks.");
	});

	it("names the properties that clash", () => {
		expect(
			describeDailyNoteOutcome({ kind: "clashing-properties", properties: ["count"] }),
		).toContain("count is claimed by more than one metric");
	});
});

describe("describeDailyNotesRun", () => {
	it("sums a run up", () => {
		expect(describeDailyNotesRun({ notes: 991, written: 12, failures: [] })).toBe(
			"Daily notes: 12 of 991 daily notes updated.",
		);
	});

	it("points at the console when something was left alone", () => {
		expect(
			describeDailyNotesRun({
				notes: 2,
				written: 1,
				failures: [{ note: "Days/2026-08-26.md", message: "locked" }],
			}),
		).toBe("Daily notes: 1 of 2 daily notes updated, 1 left alone (see the console).");
	});
});
