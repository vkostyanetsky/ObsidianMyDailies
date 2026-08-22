import type { App } from "obsidian";

import { log, logProblem } from "../log";
import { isInAnyFolder } from "../settings/settings";
import type { NotesRenameSummary } from "./rename";
import { addToSummary, describeOutcome, emptySummary, renameNoteImages } from "./rename";
import { createNoteRenameHost } from "./vault-host";

/**
 * Applies the renaming to every note of the given folders, one after the other,
 * and reports what came of it.
 *
 * A run is always asked for: by one of the commands, or once when the vault is
 * opened. Nothing here listens to the vault, so no note is ever touched while
 * it is being written.
 */
export async function renameImagesInFolders(
	app: App,
	folders: string[],
): Promise<NotesRenameSummary> {
	const all = app.vault.getMarkdownFiles();
	const notes = all.filter((note) => isInAnyFolder(note.path, folders));
	const summary = emptySummary();

	log(
		`going through ${notes.length} of ${all.length} notes of the vault, ` +
			`from ${folders.length === 0 ? "no folder" : folders.join(", ")}`,
	);

	for (const note of notes) {
		const outcome = await renameNoteImages(createNoteRenameHost(app, note));
		const line = `"${note.path}": ${describeOutcome(outcome)}`;

		if (outcome.kind === "conflict" || outcome.kind === "failed") {
			logProblem(line);
		} else if (outcome.kind === "renamed" && outcome.renamed > 0) {
			// The notes that needed nothing are not worth a line of their own.
			log(line);
		}

		addToSummary(summary, note.basename, outcome);
	}

	log(
		`done: ${summary.renamed} renamed in ${summary.notes} notes, ` +
			`${summary.failures.length} left alone`,
	);

	return summary;
}
