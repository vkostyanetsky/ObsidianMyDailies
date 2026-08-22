import type { App, Debouncer, Plugin, TAbstractFile } from "obsidian";
import { Notice, TFile, debounce } from "obsidian";

import { log, logProblem } from "../log";
import type { ToolboxSettings } from "../settings/settings";
import { isInAnyFolder, isMarkdownPath } from "../settings/settings";
import {
	addToSummary,
	describeOutcome,
	emptySummary,
	renameNoteImages,
	type ImageRenameOutcome,
	type NotesRenameSummary,
} from "./rename";
import { createNoteRenameHost } from "./vault-host";

/** How long a note is left alone after a change before it is processed. */
const SETTLE_DELAY = 1_500;

/** Whether a run that happened by itself is worth a notice of its own. */
function worthANotice(outcome: ImageRenameOutcome): boolean {
	switch (outcome.kind) {
		case "conflict":
		case "failed":
			return true;
		case "renamed":
			return outcome.renamed > 0;
		default:
			return false;
	}
}

/**
 * Keeps the images of the notes in the image folders named after their notes:
 * every note that is written to is processed once it has settled, and the whole
 * set of folders can be gone through at once.
 */
export class ImageFolderWatcher {
	private readonly app: App;
	private readonly settings: () => ToolboxSettings;

	/** One debouncer per note waiting to be processed. */
	private readonly waiting = new Map<string, Debouncer<[], void>>();

	/** Notes that are being processed right now, which are never entered twice. */
	private readonly running = new Set<string>();

	/** Whether changes are picked up yet; see {@link start}. */
	private ready = false;

	constructor(app: App, settings: () => ToolboxSettings) {
		this.app = app;
		this.settings = settings;
	}

	/** Listens to the vault for as long as the plugin is loaded. */
	register(plugin: Plugin): void {
		plugin.registerEvent(
			this.app.vault.on("create", (file) => {
				this.noteChanged(file);
			}),
		);
		plugin.registerEvent(
			this.app.vault.on("modify", (file) => {
				this.noteChanged(file);
			}),
		);
		plugin.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				// The images are named after the note, so a renamed note needs a
				// new run — under its new path, while the old one is dropped.
				this.forget(oldPath);
				this.noteChanged(file);
			}),
		);
		plugin.registerEvent(
			this.app.vault.on("delete", (file) => {
				this.forget(file.path);
			}),
		);
	}

	/**
	 * Starts picking up changes. Obsidian announces every file of the vault as
	 * created while it is reading the vault in, so listening only begins once
	 * that is over and the folders have been gone through.
	 */
	start(): void {
		this.ready = true;
	}

	/** Stops listening and drops every change that has not been processed yet. */
	stop(): void {
		this.ready = false;

		for (const debouncer of this.waiting.values()) {
			debouncer.cancel();
		}

		this.waiting.clear();
	}

	/** Whether changes to this note are picked up on their own. */
	watches(path: string): boolean {
		const settings = this.settings();

		return (
			this.ready &&
			settings.autoRenameImages &&
			isMarkdownPath(path) &&
			isInAnyFolder(path, settings.imageFolders)
		);
	}

	/**
	 * Applies the renaming to every note of the image folders, one after the
	 * other, and reports what came of it.
	 */
	async processFolders(): Promise<NotesRenameSummary> {
		const folders = this.settings().imageFolders;
		const notes = this.app.vault
			.getMarkdownFiles()
			.filter((note) => isInAnyFolder(note.path, folders));
		const summary = emptySummary();

		log(
			`going through ${notes.length} of ${this.app.vault.getMarkdownFiles().length} notes ` +
				`of the vault, from ${folders.length === 0 ? "no folder" : folders.join(", ")}`,
		);

		for (const note of notes) {
			const outcome = await this.process(note);

			if (outcome !== null) {
				this.report(note, outcome);
				addToSummary(summary, note.basename, outcome);
			}
		}

		log(
			`done: ${summary.renamed} renamed in ${summary.notes} notes, ` +
				`${summary.failures.length} left alone`,
		);

		return summary;
	}

	/** Writes what became of one note to the console. */
	private report(note: TFile, outcome: ImageRenameOutcome): void {
		const line = `"${note.path}": ${describeOutcome(outcome)}`;

		if (outcome.kind === "conflict" || outcome.kind === "failed") {
			logProblem(line);
			return;
		}

		// Only the notes that needed something are worth a line of their own.
		if (outcome.kind === "renamed" && outcome.renamed > 0) {
			log(line);
		}
	}

	/** Puts a changed note in the queue, once it is clear it belongs there. */
	private noteChanged(file: TAbstractFile): void {
		if (!(file instanceof TFile) || !this.watches(file.path)) {
			return;
		}

		const path = file.path;
		let debouncer = this.waiting.get(path);

		log(`"${path}" was written to; looking at it in ${SETTLE_DELAY} ms`);

		if (debouncer === undefined) {
			debouncer = debounce(
				() => {
					void this.processWaiting(path);
				},
				SETTLE_DELAY,
				true,
			);
			this.waiting.set(path, debouncer);
		}

		debouncer();
	}

	/** Forgets a note that is gone, or has moved on to another path. */
	private forget(path: string): void {
		const debouncer = this.waiting.get(path);

		if (debouncer !== undefined) {
			debouncer.cancel();
			this.waiting.delete(path);
		}
	}

	/** Processes a note that has settled, and says what came of it. */
	private async processWaiting(path: string): Promise<void> {
		this.waiting.delete(path);

		const file = this.app.vault.getAbstractFileByPath(path);

		// The settings may have changed, and the note may be gone, while the
		// change was settling.
		if (!(file instanceof TFile) || !this.watches(path)) {
			return;
		}

		log(`looking at "${path}"`);

		const outcome = await this.process(file);

		if (outcome === null) {
			// A run for this note was already going, and may have started before
			// the change; it is looked at again once that run is over.
			this.noteChanged(file);

			return;
		}

		this.report(file, outcome);

		// Renaming writes to the note, which comes back as another change; the
		// run it causes finds nothing left to do and passes in silence.
		if (worthANotice(outcome)) {
			new Notice(`${file.basename}: ${describeOutcome(outcome)}`);
		}
	}

	/**
	 * Renames the images of one note, unless it is already being worked on, in
	 * which case `null` comes back and the note is left to the run in flight.
	 */
	private async process(note: TFile): Promise<ImageRenameOutcome | null> {
		if (this.running.has(note.path)) {
			return null;
		}

		this.running.add(note.path);

		try {
			return await renameNoteImages(createNoteRenameHost(this.app, note));
		} finally {
			this.running.delete(note.path);
		}
	}
}
