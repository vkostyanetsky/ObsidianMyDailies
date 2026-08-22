import { Notice, Plugin } from "obsidian";

import { renameImagesInFolders } from "./images/folders";
import { describeNotesRun, describeOutcome, renameNoteImages } from "./images/rename";
import { createImageRenameHost } from "./images/vault-host";
import type { ToolboxSettings } from "./settings/settings";
import { hasFolders, readSettings } from "./settings/settings";
import { ToolboxSettingTab } from "./settings/tab";

/** How long the summary of a run over the image folders stays on screen. */
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

		this.addSettingTab(new ToolboxSettingTab(this.app, this));

		// The one run that is not asked for by hand: the image folders are brought
		// up to date with whatever was written to them while the vault was closed.
		// Nothing is watched afterwards, so notes are only ever touched on demand.
		this.app.workspace.onLayoutReady(() => {
			if (this.settings.autoRenameImages) {
				void this.renameImagesInImageFolders(true);
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
}
