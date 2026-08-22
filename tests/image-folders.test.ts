import { describe, expect, it } from "vitest";

import {
	hasFolders,
	isInAnyFolder,
	isInFolder,
	isMarkdownPath,
	normalizeFolder,
	readSettings,
	DEFAULT_SETTINGS,
} from "../src/settings/settings";
import {
	addToSummary,
	describeNotesRun,
	emptySummary,
	type NotesRenameSummary,
} from "../src/images/rename";

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

describe("hasFolders", () => {
	it("sees a folder among blank rows", () => {
		expect(hasFolders(["", " ", "Projects"])).toBe(true);
	});

	it("sees none when every row is blank", () => {
		expect(hasFolders([])).toBe(false);
		expect(hasFolders(["", "  ", "/"])).toBe(false);
	});
});

describe("isInFolder", () => {
	it("holds a note of the folder", () => {
		expect(isInFolder("Projects/Note.md", "Projects")).toBe(true);
	});

	it("holds a note of a subfolder", () => {
		expect(isInFolder("Projects/2026/Note.md", "Projects")).toBe(true);
	});

	it("ignores the case of the path", () => {
		expect(isInFolder("projects/Note.md", "Projects")).toBe(true);
	});

	it("does not hold the folder itself, nor a folder that only starts alike", () => {
		expect(isInFolder("Projects", "Projects")).toBe(false);
		expect(isInFolder("Projects Archive/Note.md", "Projects")).toBe(false);
	});

	it("holds nothing when the folder names nothing", () => {
		expect(isInFolder("Note.md", "")).toBe(false);
		expect(isInFolder("Note.md", "/")).toBe(false);
	});

	it("reads the folder as it is written in the settings", () => {
		expect(isInFolder("Projects/Note.md", " /Projects/ ")).toBe(true);
	});
});

describe("isInAnyFolder", () => {
	it("holds a note of one of the folders", () => {
		expect(isInAnyFolder("Notes/Note.md", ["Projects", "Notes"])).toBe(true);
	});

	it("holds nothing when there are no folders", () => {
		expect(isInAnyFolder("Notes/Note.md", [])).toBe(false);
	});
});

describe("isMarkdownPath", () => {
	it("recognises a note, whatever the case of its extension", () => {
		expect(isMarkdownPath("Projects/Note.md")).toBe(true);
		expect(isMarkdownPath("Projects/Note.MD")).toBe(true);
	});

	it("does not recognise anything else", () => {
		expect(isMarkdownPath("Projects/Image.png")).toBe(false);
		expect(isMarkdownPath("Projects/README")).toBe(false);
	});
});

describe("readSettings", () => {
	it("falls back to the defaults when nothing was stored", () => {
		expect(readSettings(null)).toEqual(DEFAULT_SETTINGS);
		expect(readSettings(undefined)).toEqual(DEFAULT_SETTINGS);
	});

	it("keeps what was stored", () => {
		expect(readSettings({ imageFolders: ["Projects"], autoRenameImages: true })).toEqual({
			imageFolders: ["Projects"],
			autoRenameImages: true,
		});
	});

	it("leaves out folders that are not paths, and mends a broken flag", () => {
		expect(readSettings({ imageFolders: ["Projects", 7, null], autoRenameImages: "yes" })).toEqual({
			imageFolders: ["Projects"],
			autoRenameImages: false,
		});
	});

	it("does not hand out the default array itself", () => {
		const settings = readSettings({});

		settings.imageFolders.push("Projects");

		expect(DEFAULT_SETTINGS.imageFolders).toEqual([]);
	});
});

describe("a run over several notes", () => {
	function summaryOf(...outcomes: [string, Parameters<typeof addToSummary>[2]][]): NotesRenameSummary {
		const summary = emptySummary();

		for (const [note, outcome] of outcomes) {
			addToSummary(summary, note, outcome);
		}

		return summary;
	}

	it("counts the renamed images of every note", () => {
		const summary = summaryOf(
			["First", { kind: "renamed", renamed: 3, skipped: 0, shared: 0 }],
			["Second", { kind: "renamed", renamed: 2, skipped: 1, shared: 0 }],
			["Third", { kind: "no-images" }],
		);

		expect(summary).toEqual({ notes: 3, renamed: 5, failures: [] });
		expect(describeNotesRun(summary)).toBe("Renamed 5 images in 3 notes.");
	});

	it("keeps the notes that could not be processed", () => {
		const summary = summaryOf(
			["First", { kind: "renamed", renamed: 1, skipped: 0, shared: 0 }],
			["Second", { kind: "conflict", path: "Notes/Second 1.png" }],
			["Third", { kind: "failed", message: "the vault is busy" }],
		);

		expect(summary.notes).toBe(3);
		expect(summary.renamed).toBe(1);
		expect(describeNotesRun(summary)).toBe(
			'Renamed 1 image in 3 notes.\n' +
				'Second: Nothing was renamed: "Notes/Second 1.png" is already taken by another file.\n' +
				"Third: Could not rename the images: the vault is busy",
		);
	});

	it("says so when nothing had to be renamed", () => {
		const summary = summaryOf(["Only", { kind: "renamed", renamed: 0, skipped: 0, shared: 0 }]);

		expect(describeNotesRun(summary)).toBe("The images in 1 note are already named correctly.");
	});

	it("says so when the folders hold no notes", () => {
		expect(describeNotesRun(emptySummary())).toBe("There are no notes in the image folders.");
	});
});
