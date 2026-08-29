import { describe, expect, it } from "vitest";

import {
	isInFolder,
	normalizeFolder,
	normalizeProperty,
	readSettings,
	DEFAULT_SETTINGS,
} from "../src/settings/settings";

describe("normalizeFolder", () => {
	it("keeps a plain vault-relative folder", () => {
		expect(normalizeFolder("Projects/Notes")).toBe("Projects/Notes");
	});

	it("drops surrounding whitespace and slashes", () => {
		expect(normalizeFolder("  /Projects/Notes/  ")).toBe("Projects/Notes");
	});

	it("collapses repeated separators", () => {
		expect(normalizeFolder("Projects//Notes")).toBe("Projects/Notes");
	});

	it("turns the vault root into an empty string", () => {
		expect(normalizeFolder("/")).toBe("");
		expect(normalizeFolder("   ")).toBe("");
	});
});

describe("normalizeProperty", () => {
	it("trims the name as it was typed", () => {
		expect(normalizeProperty("  calories ", "calories")).toBe("calories");
	});

	it("falls back to the default for a name that names nothing", () => {
		expect(normalizeProperty("   ", "tasks")).toBe("tasks");
	});
});

describe("isInFolder", () => {
	it("holds a note of the folder", () => {
		expect(isInFolder("Days/2026-08-29.md", "Days")).toBe(true);
	});

	it("holds a note of a subfolder", () => {
		expect(isInFolder("Days/2026/2026-08-29.md", "Days")).toBe(true);
	});

	it("ignores the case of the path", () => {
		expect(isInFolder("days/2026-08-29.md", "Days")).toBe(true);
	});

	it("does not hold the folder itself, nor a folder that only starts alike", () => {
		expect(isInFolder("Days", "Days")).toBe(false);
		expect(isInFolder("Days Archive/2026-08-29.md", "Days")).toBe(false);
	});

	it("holds nothing when the folder names nothing", () => {
		expect(isInFolder("2026-08-29.md", "")).toBe(false);
		expect(isInFolder("2026-08-29.md", "/")).toBe(false);
	});

	it("reads the folder as it is written in the settings", () => {
		expect(isInFolder("Days/2026-08-29.md", " /Days/ ")).toBe(true);
	});
});

describe("readSettings", () => {
	it("falls back to the defaults when nothing was stored", () => {
		expect(readSettings(null)).toEqual(DEFAULT_SETTINGS);
		expect(readSettings(undefined)).toEqual(DEFAULT_SETTINGS);
	});

	it("mends a flag of the wrong shape", () => {
		expect(readSettings({ dailyNotes: { autoUpdate: "yes" } }).dailyNotes.autoUpdate).toBe(
			false,
		);
	});

	it("leaves the image folders of an older installation alone", () => {
		// They belong to My Images now, and a data.json that still carries them
		// is read for the daily notes just the same.
		expect(readSettings({ imageFolders: ["Notes"], autoRenameImages: true })).toEqual(
			DEFAULT_SETTINGS,
		);
	});

	it("does not hand out the default properties themselves", () => {
		const settings = readSettings({});

		settings.nutrition.properties.calories = "ккал";

		expect(DEFAULT_SETTINGS.nutrition.properties.calories).toBe("calories");
	});
});
