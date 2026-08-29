/*
 * Binding the navigation to the vault: which note the block sits in, how the
 * days and the months of that note are written out, and how the whole thing
 * reaches the screen.
 *
 * The block is rendered where it is written and nothing else is touched: no
 * note is created, no link is followed, and a day the vault has no note for is
 * still linked, as an empty link Obsidian offers to fill.
 */

import type { App, MarkdownPostProcessorContext } from "obsidian";
import { MarkdownRenderChild, MarkdownRenderer, moment, normalizePath } from "obsidian";

import { dailyNotesFolder } from "../daily-notes/vault-host";
import { dailyNoteDate, isInDailyNotesFolder } from "../daily-notes/notes";
import type { MyDailiesSettings } from "../settings/settings";
import { normalizeFolder } from "../settings/settings";
import type { DateWording, NavigationPlaces } from "./dashboard";
import { buildDashboard } from "./dashboard";

/** The language of the code block the navigation is written into. */
export const NAVIGATION_BLOCK = "my-dailies-navigation";

/**
 * What the block was called while it belonged to the Daily Note Navigator. It
 * is still answered, so that the notes that carry it keep their navigation.
 */
export const LEGACY_NAVIGATION_BLOCK = "daily-note-navigator";

/** A day and a month as Moment writes them, in the language of the vault. */
const WORDING: DateWording = {
	day: (date, format) => moment(date, "YYYY-MM-DD", true).format(format),
	month: (yearMonth, format) => moment(`${yearMonth}-01`, "YYYY-MM-DD", true).format(format),
};

/** Where the notes the block points at are kept, as the settings have it. */
function places(app: App, settings: MyDailiesSettings): NavigationPlaces {
	return {
		dailyNotesFolder: dailyNotesFolder(app, settings),
		monthlyNotesFolder: normalizeFolder(settings.navigation.monthlyNotesFolder),
		monthlyNoteName: settings.navigation.monthlyNoteName,
	};
}

/** A folder as a notice names it. */
function folderLabel(folder: string): string {
	return folder === "" ? "the vault root" : `"${folder}"`;
}

/**
 * The Markdown the block comes to: the navigation of the note it sits in, or
 * the reason there is none to show.
 */
function blockMarkdown(app: App, settings: MyDailiesSettings, notePath: string, source: string): string {
	const file = app.vault.getFileByPath(normalizePath(notePath));

	if (file === null) {
		return "> [!warning] The note this block sits in cannot be found.";
	}

	const date = dailyNoteDate(file.basename);
	const folder = dailyNotesFolder(app, settings);

	if (date === null) {
		return (
			`> [!warning] "${file.basename}" does not stand for a day. ` +
			"A daily note is named after one, such as 2026-08-29."
		);
	}

	if (!isInDailyNotesFolder(file.path, folder)) {
		return `> [!warning] This note is not in the daily notes folder, ${folderLabel(folder)}.`;
	}

	return buildDashboard(date, places(app, settings), WORDING, source);
}

/**
 * Renders the navigation block of a note. The rendering is tied to the block
 * itself rather than to the plugin, so that it is taken down again as soon as
 * the block leaves the screen.
 */
export function createNavigationRenderer(
	app: App,
	settings: () => MyDailiesSettings,
): (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void> {
	return async (source, el, ctx) => {
		el.replaceChildren();

		const child = new MarkdownRenderChild(el);

		ctx.addChild(child);

		await MarkdownRenderer.render(
			app,
			blockMarkdown(app, settings(), ctx.sourcePath, source),
			el,
			ctx.sourcePath,
			child,
		);
	};
}
