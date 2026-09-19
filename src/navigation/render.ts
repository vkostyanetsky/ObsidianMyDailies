/*
 * What the two navigation blocks have in common: where the notes they point at
 * are kept, how a day and a month are worded, and how Markdown worked out for
 * a note reaches the screen.
 *
 * A block is rendered where it is written and nothing else is touched: no note
 * is created, no link is followed, and a day or a month the vault has no note
 * for is still linked, as an empty link Obsidian offers to fill.
 */

import type { App, MarkdownPostProcessorContext, TFile } from "obsidian";
import { MarkdownRenderChild, MarkdownRenderer, moment, normalizePath } from "obsidian";

import { dailyNotesFolder } from "../daily-notes/vault-host";
import type { MyDailiesSettings } from "../settings/settings";
import { normalizeFolder } from "../settings/settings";
import type { DateWording, NavigationPlaces } from "./dashboard";

/** A day and a month as Moment writes them, in the language of the vault. */
export const WORDING: DateWording = {
	day: (date, format) => moment(date, "YYYY-MM-DD", true).format(format),
	month: (yearMonth, format) => moment(`${yearMonth}-01`, "YYYY-MM-DD", true).format(format),
};

/** Where the notes the blocks point at are kept, as the settings have it. */
export function places(app: App, settings: MyDailiesSettings): NavigationPlaces {
	return {
		dailyNotesFolder: dailyNotesFolder(app, settings),
		monthlyNotesFolder: normalizeFolder(settings.navigation.monthlyNotesFolder),
		monthlyNoteName: settings.navigation.monthlyNoteName,
	};
}

/** A folder as a notice names it. */
export function folderLabel(folder: string): string {
	return folder === "" ? "the vault root" : `"${folder}"`;
}

/** A warning the block comes to instead of a navigation. */
export function warning(text: string): string {
	return `> [!warning] ${text}`;
}

/** How a block works its Markdown out of the note it sits in. */
export type BlockMarkdown = (
	app: App,
	settings: MyDailiesSettings,
	file: TFile,
	source: string,
) => string;

/**
 * Renders a navigation block of a note. The rendering is tied to the block
 * itself rather than to the plugin, so that it is taken down again as soon as
 * the block leaves the screen.
 */
export function createNavigationRenderer(
	app: App,
	settings: () => MyDailiesSettings,
	markdown: BlockMarkdown,
): (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void> {
	return async (source, el, ctx) => {
		el.replaceChildren();

		const child = new MarkdownRenderChild(el);

		ctx.addChild(child);

		const file = app.vault.getFileByPath(normalizePath(ctx.sourcePath));

		await MarkdownRenderer.render(
			app,
			file === null
				? warning("The note this block sits in cannot be found.")
				: markdown(app, settings(), file, source),
			el,
			ctx.sourcePath,
			child,
		);
	};
}
