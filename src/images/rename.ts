import type { TextEdit } from "../markdown/edits";
import { findImageEmbeds } from "./links";
import {
	buildRenamePlan,
	collectLinkEdits,
	collectRepairEdits,
	findRenameConflict,
} from "./plan";
import { fileExtension, joinPath, parentPath } from "./paths";
import type { RenameEntry, RenamedFile, ResolvedEmbed, VaultFile } from "./types";

/** Prefix of the names images carry while they are being shuffled around. */
const TEMPORARY_PREFIX = "renaming-image";

/** How many names are tried before a temporary name is given up on. */
const TEMPORARY_ATTEMPTS = 10_000;

/**
 * Everything the renaming needs from its surroundings. Keeping it behind an
 * interface leaves the logic free of the Obsidian API.
 */
export interface ImageRenameHost {
	/** Name of the note, without its `.md` extension. */
	readonly noteName: string;
	/** Current content of the note. */
	readNote(): string;
	/** Resolves a link path against the note, or `null` for a broken link. */
	resolveImage(linkPath: string): VaultFile | null;
	/** Whether anything at all sits at the given vault path. */
	exists(path: string): boolean;
	/** Renames the file currently at `from` to `to`. */
	renameFile(from: string, to: string): Promise<void>;
	/** Rewrites the note, as one undoable step. */
	updateNote(edits: TextEdit[]): void;
}

/** A rename that has been carried out and can still be taken back. */
export interface RenameOperation {
	/** Name the file had before the operation started. */
	originalPath: string;
	/** Name the file carries right now. */
	currentPath: string;
}

/** What became of a run of the command, ready to be turned into a notice. */
export type ImageRenameOutcome =
	| { kind: "no-note" }
	| { kind: "no-images" }
	| { kind: "conflict"; path: string }
	| { kind: "failed"; message: string }
	| { kind: "renamed"; renamed: number; skipped: number };

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Finds a free name in the folder of `path`, keeping the extension. */
function temporaryPath(host: ImageRenameHost, path: string, seed: number): string {
	const folder = parentPath(path);
	const extension = fileExtension(path);

	for (let counter = seed; counter < seed + TEMPORARY_ATTEMPTS; counter += 1) {
		const name =
			extension === ""
				? `${TEMPORARY_PREFIX}-${counter}`
				: `${TEMPORARY_PREFIX}-${counter}.${extension}`;
		const candidate = joinPath(folder, name);

		if (!host.exists(candidate)) {
			return candidate;
		}
	}

	throw new Error(`No free temporary name in "${folder === "" ? "/" : folder}".`);
}

/** Puts every file back under the name it had, as far as that still works. */
export async function revertRenames(
	host: ImageRenameHost,
	operations: RenameOperation[],
): Promise<void> {
	for (let index = operations.length - 1; index >= 0; index -= 1) {
		const operation = operations[index];

		if (operation.currentPath === operation.originalPath) {
			continue;
		}

		try {
			await host.renameFile(operation.currentPath, operation.originalPath);
			operation.currentPath = operation.originalPath;
		} catch {
			// Reverting is a best effort; the remaining files are still tried.
		}
	}
}

/**
 * Carries out the plan and returns the renames that were performed.
 *
 * Every file is first moved to a name nothing else can hold and only then given
 * its final name, so that images may swap names among themselves. When a rename
 * fails, the ones that already happened are taken back and the error is
 * rethrown, leaving the vault as it was.
 */
export async function executeRenamePlan(
	host: ImageRenameHost,
	entries: RenameEntry[],
): Promise<RenameOperation[]> {
	const pending = entries.filter((entry) => entry.targetPath !== entry.file.path);
	const operations: RenameOperation[] = [];

	try {
		for (const entry of pending) {
			const temporary = temporaryPath(host, entry.file.path, operations.length);
			await host.renameFile(entry.file.path, temporary);
			operations.push({ originalPath: entry.file.path, currentPath: temporary });
		}

		for (let index = 0; index < pending.length; index += 1) {
			await host.renameFile(operations[index].currentPath, pending[index].targetPath);
			operations[index].currentPath = pending[index].targetPath;
		}
	} catch (error) {
		await revertRenames(host, operations);
		throw error;
	}

	return operations;
}

function renamedFiles(entries: RenameEntry[]): RenamedFile[] {
	return entries.map((entry) => ({
		originalPath: entry.file.path,
		file: { path: entry.targetPath, extension: entry.file.extension },
	}));
}

async function renameImages(host: ImageRenameHost): Promise<ImageRenameOutcome> {
	const source = host.readNote();
	const resolved: ResolvedEmbed[] = findImageEmbeds(source).map((embed) => ({
		embed,
		file: host.resolveImage(embed.path),
	}));

	if (resolved.length === 0) {
		return { kind: "no-images" };
	}

	const plan = buildRenamePlan(host.noteName, resolved);
	const conflict = findRenameConflict(plan.entries, (path) => host.exists(path));

	if (conflict !== null) {
		return { kind: "conflict", path: conflict };
	}

	const edits = collectLinkEdits(resolved, plan.entries);
	let operations: RenameOperation[];

	try {
		operations = await executeRenamePlan(host, plan.entries);
	} catch (error) {
		return { kind: "failed", message: describeError(error) };
	}

	try {
		const current = host.readNote();

		// Obsidian rewrites internal links itself unless the user turned that off,
		// in which case the note is still untouched and the planned edits apply.
		host.updateNote(
			current === source
				? edits
				: collectRepairEdits(current, renamedFiles(plan.entries), (path) =>
						host.resolveImage(path),
					),
		);
	} catch (error) {
		await revertRenames(host, operations);
		return { kind: "failed", message: describeError(error) };
	}

	return { kind: "renamed", renamed: operations.length, skipped: plan.unresolved };
}

/**
 * Renames every image embedded in the note after the note itself, numbering
 * them in order of first appearance, and points the links of the note at the
 * new names.
 *
 * Nothing at all is changed when a target name is taken by a file outside of
 * the operation, or when any of the renames fails. Every failure is reported
 * through the returned outcome, so the call never rejects.
 */
export async function renameNoteImages(host: ImageRenameHost | null): Promise<ImageRenameOutcome> {
	if (host === null) {
		return { kind: "no-note" };
	}

	try {
		return await renameImages(host);
	} catch (error) {
		return { kind: "failed", message: describeError(error) };
	}
}

function describeSkipped(skipped: number): string {
	if (skipped === 0) {
		return "";
	}

	return `, skipped ${skipped} unresolved ${skipped === 1 ? "link" : "links"}`;
}

/** The notice shown for an outcome. */
export function describeOutcome(outcome: ImageRenameOutcome): string {
	switch (outcome.kind) {
		case "no-note":
			return "No active Markdown note.";
		case "no-images":
			return "No images are embedded in the current note.";
		case "conflict":
			return `Nothing was renamed: "${outcome.path}" is already taken by another file.`;
		case "failed":
			return `Could not rename the images: ${outcome.message}`;
		case "renamed":
			return outcome.renamed === 0
				? `The images are already named correctly${describeSkipped(outcome.skipped)}.`
				: `Renamed ${outcome.renamed} ${outcome.renamed === 1 ? "image" : "images"}${describeSkipped(outcome.skipped)}.`;
	}
}
