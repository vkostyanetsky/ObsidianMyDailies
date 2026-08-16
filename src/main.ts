import { Notice, Plugin } from "obsidian";

import { describeOutcome, renameNoteImages } from "./images/rename";
import { createImageRenameHost } from "./images/vault-host";

export default class ToolboxPlugin extends Plugin {
	onload(): void {
		this.addCommand({
			id: "rename-images",
			name: "Rename images in current note",
			callback: () => {
				void this.renameImagesOfActiveNote();
			},
		});
	}

	/**
	 * Renames the images embedded in the active Markdown note after the note
	 * itself, numbering them in order of appearance, and reports the result.
	 */
	private async renameImagesOfActiveNote(): Promise<void> {
		const outcome = await renameNoteImages(createImageRenameHost(this.app));

		new Notice(describeOutcome(outcome));
	}
}
