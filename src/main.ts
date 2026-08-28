import { MarkdownView, Notice, Plugin } from "obsidian";

import type { DailyNote, DayMetricSource } from "./daily-notes/metrics";
import {
	describeDailyNoteOutcome,
	describeDailyNotesRun,
	updateAllDailyNotes,
	updateDailyNote,
} from "./daily-notes/metrics";
import { asDailyNote, createDailyNotesHost, logFailures } from "./daily-notes/vault-host";
import { renameImagesInFolders } from "./images/folders";
import { describeNotesRun, describeOutcome, renameNoteImages } from "./images/rename";
import { createImageRenameHost } from "./images/vault-host";
import { createNutritionMetric } from "./nutrition/metric";
import type { ToolboxSettings } from "./settings/settings";
import { hasFolders, readSettings } from "./settings/settings";
import { ToolboxSettingTab } from "./settings/tab";
import { createOpenTasksMetric } from "./tasks/metric";

/** How long the summary of a run over many notes stays on screen. */
const SUMMARY_NOTICE_DURATION = 10_000;

export default class ToolboxPlugin extends Plugin {
	settings: ToolboxSettings = readSettings(null);

	async onload(): Promise<void> {
		this.settings = readSettings(await this.loadData());

		this.addCommand({
			id: "rename-images",
			name: "Rename images in current note",
			callback: () => {
				void this.renameImagesOfActiveNote();
			},
		});

		this.addCommand({
			id: "rename-images-in-folders",
			name: "Rename images in image folders",
			callback: () => {
				void this.renameImagesInImageFolders();
			},
		});

		// The command is not offered at all unless the note in front of the user
		// stands for a day, today's or any other.
		this.addCommand({
			id: "recalculate-daily-note",
			name: "Recalculate properties of current daily note",
			checkCallback: (checking) => {
				const note = this.activeDailyNote();

				if (note === null) {
					return false;
				}

				if (!checking) {
					void this.updateDailyNote(note);
				}

				return true;
			},
		});

		this.addCommand({
			id: "recalculate-daily-notes",
			name: "Recalculate properties of all daily notes",
			callback: () => {
				void this.updateAllDailyNotes();
			},
		});

		this.addSettingTab(new ToolboxSettingTab(this.app, this));

		// The only two runs that are not asked for by hand: the image folders and
		// the daily notes are brought up to date with whatever was written while
		// the vault was closed. Nothing is watched afterwards, so a note is only
		// ever touched on demand.
		this.app.workspace.onLayoutReady(() => {
			if (this.settings.autoRenameImages) {
				void this.renameImagesInImageFolders(true);
			}

			if (this.settings.dailyNotes.autoUpdate) {
				void this.updateAllDailyNotes(true);
			}
		});
	}

	/** Writes the settings back, so that they survive a restart. */
	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Renames the images embedded in the active Markdown note after the note
	 * itself, numbering them in order of appearance, and reports the result.
	 */
	private async renameImagesOfActiveNote(): Promise<void> {
		const outcome = await renameNoteImages(createImageRenameHost(this.app));

		new Notice(describeOutcome(outcome));
	}

	/**
	 * Does the same for every note of the image folders. A quiet run only speaks
	 * up when something was renamed or went wrong.
	 */
	private async renameImagesInImageFolders(quiet = false): Promise<void> {
		if (!hasFolders(this.settings.imageFolders)) {
			if (!quiet) {
				new Notice("No image folders are set. Add one in the settings of the plugin.");
			}

			return;
		}

		const summary = await renameImagesInFolders(this.app, this.settings.imageFolders);

		if (quiet && summary.renamed === 0 && summary.failures.length === 0) {
			return;
		}

		new Notice(describeNotesRun(summary), SUMMARY_NOTICE_DURATION);
	}

	/**
	 * The metrics that are switched on and configured, in the order their
	 * properties are written in. A new one is added here and nowhere else.
	 */
	private metrics(): DayMetricSource[] {
		return [
			createNutritionMetric(this.app, this.settings),
			createOpenTasksMetric(this.app, this.settings),
		].filter((source): source is DayMetricSource => source !== null);
	}

	/**
	 * The note in front of the user, but only when it stands for a day and sits
	 * where the daily notes are kept. Anything else is not a daily note, and the
	 * command that works on one is not offered for it.
	 */
	private activeDailyNote(): DailyNote | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);

		if (view === null || view.file === null) {
			return null;
		}

		return asDailyNote(this.app, view.file, this.settings);
	}

	/** Works out the properties of one daily note and reports the result. */
	private async updateDailyNote(note: DailyNote): Promise<void> {
		const host = createDailyNotesHost(this.app, this.settings);
		const outcome = await updateDailyNote(host, this.metrics(), note);

		new Notice(describeDailyNoteOutcome(outcome));
	}

	/**
	 * Does the same for every daily note of the vault. A quiet run only speaks up
	 * when something was written or went wrong.
	 */
	private async updateAllDailyNotes(quiet = false): Promise<void> {
		const host = createDailyNotesHost(this.app, this.settings);
		const outcome = await updateAllDailyNotes(host, this.metrics());

		if ("kind" in outcome) {
			if (!quiet) {
				new Notice(describeDailyNoteOutcome(outcome));
			}

			return;
		}

		logFailures(outcome.failures);

		if (quiet && outcome.written === 0 && outcome.failures.length === 0) {
			return;
		}

		new Notice(describeDailyNotesRun(outcome), SUMMARY_NOTICE_DURATION);
	}
}
