import { MarkdownView, Notice, Plugin } from "obsidian";

import { applyEditsToEditor } from "./editor/apply-edits";
import { describeOutcome, renameNoteImages } from "./images/rename";
import { createImageRenameHost } from "./images/vault-host";
import { collectRenumberEdits } from "./renumber/edits";

export default class ToolboxPlugin extends Plugin {
	onload(): void {
		this.addCommand({
			id: "renumber-frames",
			name: "Renumber frames in current note",
			callback: () => {
				this.renumberActiveNote();
			},
		});

		this.addCommand({
			id: "rename-images",
			name: "Rename images in current note",
			callback: () => {
				void this.renameImagesOfActiveNote();
			},
		});
	}

	/**
	 * Renumbers section and frame headings of the active Markdown note. Does
	 * nothing when no Markdown note is open, or when the note is already numbered
	 * correctly.
	 */
	private renumberActiveNote(): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);

		if (view === null) {
			new Notice("No active Markdown note.");
			return;
		}

		const editor = view.editor;
		applyEditsToEditor(editor, collectRenumberEdits(editor.getValue()));
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
