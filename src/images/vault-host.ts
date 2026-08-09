import type { App } from "obsidian";
import { MarkdownView, TFile, normalizePath } from "obsidian";

import { applyEditsToEditor } from "../editor/apply-edits";
import { parentPath, resolveRelativePath } from "./paths";
import type { ImageRenameHost } from "./rename";
import type { VaultFile } from "./types";

function snapshot(file: TFile): VaultFile {
	return { path: file.path, extension: file.extension };
}

function fileAt(app: App, path: string): TFile | null {
	const file = app.vault.getAbstractFileByPath(normalizePath(path));

	return file instanceof TFile ? file : null;
}

/**
 * Resolves the path of an embed the way Obsidian does, falling back to a path
 * relative to the note and to a vault-absolute path, which covers the Markdown
 * link syntax as well.
 */
function resolveImage(app: App, linkPath: string, notePath: string): VaultFile | null {
	const linked = app.metadataCache.getFirstLinkpathDest(linkPath, notePath);
	if (linked instanceof TFile) {
		return snapshot(linked);
	}

	const relative = fileAt(app, resolveRelativePath(parentPath(notePath), linkPath));
	if (relative !== null) {
		return snapshot(relative);
	}

	const absolute = fileAt(app, linkPath);

	return absolute === null ? null : snapshot(absolute);
}

/**
 * Binds the image renaming to the Markdown note that is open right now, or
 * returns `null` when there is none.
 */
export function createImageRenameHost(app: App): ImageRenameHost | null {
	const view = app.workspace.getActiveViewOfType(MarkdownView);

	if (view === null || view.file === null) {
		return null;
	}

	const note = view.file;
	const editor = view.editor;

	return {
		noteName: note.basename,
		readNote: () => editor.getValue(),
		resolveImage: (linkPath) => resolveImage(app, linkPath, note.path),
		exists: (path) => app.vault.getAbstractFileByPath(normalizePath(path)) !== null,
		renameFile: async (from, to) => {
			const file = fileAt(app, from);

			if (file === null) {
				throw new Error(`there is no file at "${from}"`);
			}

			await app.fileManager.renameFile(file, normalizePath(to));
		},
		updateNote: (edits) => {
			applyEditsToEditor(editor, edits);
		},
	};
}
