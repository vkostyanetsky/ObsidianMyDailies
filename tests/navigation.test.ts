import { describe, expect, it } from "vitest";

import type { DateWording, NavigationPlaces } from "../src/navigation/dashboard";
import {
	buildDailyNoteNavigation,
	buildMonthlyNoteNavigation,
	monthlyNoteName,
	DEFAULT_MONTHLY_NOTE_NAME,
} from "../src/navigation/dashboard";
import { monthOf, shiftDay, shiftMonth } from "../src/navigation/dates";
import { readSettings, DEFAULT_SETTINGS } from "../src/settings/settings";

/** The months, as an English vault writes them. */
const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

/** The days of a week, starting on the Sunday a `Date` counts from. */
const WEEKDAYS = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

/**
 * A stand-in for Moment, covering the handful of formats the block asks for.
 * Only what the dashboard uses has to come out right.
 */
const wording: DateWording = {
	day: (date, format) => {
		const day = new Date(`${date}T00:00:00Z`);

		return format === "dddd" ? WEEKDAYS[day.getUTCDay()] : date;
	},
	month: (yearMonth, format) => {
		const [year, month] = yearMonth.split("-");
		const name = MONTHS[Number(month) - 1];

		switch (format) {
			case "MMM":
				return name.slice(0, 3);
			case "MMMM YYYY":
				return `${name} ${year}`;
			default:
				return yearMonth;
		}
	},
};

const places: NavigationPlaces = {
	dailyNotesFolder: "Days",
	monthlyNotesFolder: "Months",
	monthlyNoteName: DEFAULT_MONTHLY_NOTE_NAME,
};

describe("the days around a day", () => {
	it("steps to the day before and the day after", () => {
		expect(shiftDay("2026-08-29", -1)).toBe("2026-08-28");
		expect(shiftDay("2026-08-29", 1)).toBe("2026-08-30");
	});

	it("steps over the end of a month and of a year", () => {
		expect(shiftDay("2026-09-01", -1)).toBe("2026-08-31");
		expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
	});

	it("knows the day a leap year has", () => {
		expect(shiftDay("2028-02-28", 1)).toBe("2028-02-29");
		expect(shiftDay("2026-02-28", 1)).toBe("2026-03-01");
	});
});

describe("the months around a month", () => {
	it("takes the month of a day", () => {
		expect(monthOf("2026-08-29")).toBe("2026-08");
	});

	it("steps to the month before and the month after", () => {
		expect(shiftMonth("2026-08", -1)).toBe("2026-07");
		expect(shiftMonth("2026-08", 1)).toBe("2026-09");
	});

	it("steps over the turn of a year", () => {
		expect(shiftMonth("2026-01", -1)).toBe("2025-12");
		expect(shiftMonth("2026-12", 1)).toBe("2027-01");
	});

	it("never lands on a day a month does not have", () => {
		// Counted from the last day of a month, a step would land on the 31st of
		// a month of thirty days, which is the first of the month after it.
		expect(shiftMonth(monthOf("2026-01-31"), 1)).toBe("2026-02");
	});
});

describe("the name of a monthly note", () => {
	it("writes the month where the braces are", () => {
		expect(monthlyNoteName("2026-08", "Month {YYYY-MM}", wording)).toBe("Month 2026-08");
		expect(monthlyNoteName("2026-08", "{MMMM YYYY}", wording)).toBe("August 2026");
	});

	it("keeps everything outside the braces as it is", () => {
		expect(monthlyNoteName("2026-08", "Отчёт за {MMMM YYYY}", wording)).toBe(
			"Отчёт за August 2026",
		);
	});

	it("leaves empty braces alone", () => {
		expect(monthlyNoteName("2026-08", "Month {}", wording)).toBe("Month {}");
	});

	it("falls back to the default when it names nothing", () => {
		expect(monthlyNoteName("2026-08", "   ", wording)).toBe("Month 2026-08");
	});
});

describe("the navigation of a daily note", () => {
	it("links the days around it and the months around its own", () => {
		expect(buildDailyNoteNavigation("2026-08-29", places, wording)).toBe(
			[
				"> [!seealso] Saturday",
				"> 📅 [[Days/2026-08-28|2026-08-28]] ← 2026-08-29 → [[Days/2026-08-30|2026-08-30]]",
				"> ",
				"[[Months/Month 2026-07|JUL]] ⬅️ [[Months/Month 2026-08|AUG]] ➡️ " +
					"[[Months/Month 2026-09|SEP]]",
			].join("\n"),
		);
	});

	it("links into the vault root when no folder is named", () => {
		const root: NavigationPlaces = {
			dailyNotesFolder: "",
			monthlyNotesFolder: "",
			monthlyNoteName: DEFAULT_MONTHLY_NOTE_NAME,
		};

		expect(buildDailyNoteNavigation("2026-08-29", root, wording)).toContain(
			"[[2026-08-28|2026-08-28]] ← 2026-08-29 → [[2026-08-30|2026-08-30]]",
		);
		expect(buildDailyNoteNavigation("2026-08-29", root, wording)).toContain(
			"[[Month 2026-08|AUG]]",
		);
	});

	it("writes what the block itself carries underneath, quoted", () => {
		const dashboard = buildDailyNoteNavigation(
			"2026-08-29",
			places,
			wording,
			"Woke up late.\n\n- [ ] Run",
		);

		expect(dashboard.split("\n").slice(4)).toEqual([
			">",
			"> Woke up late.",
			">",
			"> - [ ] Run",
		]);
	});

	it("says nothing more when the block is empty", () => {
		expect(
			buildDailyNoteNavigation("2026-08-29", places, wording, "  \n ").split("\n"),
		).toHaveLength(4);
	});
});

describe("the navigation of a monthly note", () => {
	it("links the month itself and the months on either side", () => {
		expect(buildMonthlyNoteNavigation("2026-09", places, wording)).toBe(
			"[[Months/Month 2026-08|AUG]] ⬅️ [[Months/Month 2026-09|SEP]] ➡️ " +
				"[[Months/Month 2026-10|OCT]]",
		);
	});

	it("steps over the turn of a year", () => {
		expect(buildMonthlyNoteNavigation("2026-12", places, wording)).toBe(
			"[[Months/Month 2026-11|NOV]] ⬅️ [[Months/Month 2026-12|DEC]] ➡️ " +
				"[[Months/Month 2027-01|JAN]]",
		);
	});

	it("names the months exactly as a daily note names them", () => {
		expect(buildDailyNoteNavigation("2026-09-15", places, wording)).toContain(
			buildMonthlyNoteNavigation("2026-09", places, wording),
		);
	});

	it("links into the vault root when no folder is named", () => {
		const root: NavigationPlaces = {
			dailyNotesFolder: "",
			monthlyNotesFolder: "",
			monthlyNoteName: DEFAULT_MONTHLY_NOTE_NAME,
		};

		expect(buildMonthlyNoteNavigation("2026-09", root, wording)).toContain(
			"[[Month 2026-09|SEP]]",
		);
	});

	it("writes what the block itself carries underneath", () => {
		const navigation = buildMonthlyNoteNavigation("2026-09", places, wording, "Half a year in.");

		expect(navigation.split("\n").slice(1)).toEqual(["", "Half a year in."]);
	});

	it("says nothing more when the block is empty", () => {
		expect(
			buildMonthlyNoteNavigation("2026-09", places, wording, "  \n ").split("\n"),
		).toHaveLength(1);
	});
});

describe("the settings of the navigation", () => {
	it("starts a fresh installation off with the default name", () => {
		expect(DEFAULT_SETTINGS.navigation).toEqual({
			monthlyNotesFolder: "",
			monthlyNoteName: "Month {YYYY-MM}",
		});
	});

	it("keeps what was stored", () => {
		const settings = readSettings({
			navigation: { monthlyNotesFolder: "Months", monthlyNoteName: "Месяц {YYYY-MM}" },
		});

		expect(settings.navigation.monthlyNotesFolder).toBe("Months");
		expect(settings.navigation.monthlyNoteName).toBe("Месяц {YYYY-MM}");
	});

	it("falls back to the default for a name that names nothing", () => {
		expect(readSettings({ navigation: { monthlyNoteName: "   " } }).navigation.monthlyNoteName).toBe(
			"Month {YYYY-MM}",
		);
	});

	it("carries the settings over from the plugin the block came from", () => {
		// They sat flat at the top of the data.json of the Daily Note Navigator,
		// which is the file a vault that used it still has.
		const settings = readSettings({
			monthlyNotesFolder: "Отчёты/Месяцы",
			monthlyNoteNameTemplate: "Месяц {YYYY-MM}",
		});

		expect(settings.navigation).toEqual({
			monthlyNotesFolder: "Отчёты/Месяцы",
			monthlyNoteName: "Месяц {YYYY-MM}",
		});
	});
});
