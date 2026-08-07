import { MarkdownView, Notice, Plugin } from "obsidian";

import { applyEditsToEditor } from "./editor/apply-edits";
import { collectRenumberEdits } from "./renumber/edits";

export default class YoinToolkitPlugin extends Plugin {
	onload(): void {
		this.addCommand({
			id: "renumber-frames",
			name: "Renumber frames in current note",
			callback: () => {
				this.renumberActiveNote();
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
}
