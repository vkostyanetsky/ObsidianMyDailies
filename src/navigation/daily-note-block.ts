/*
 * The navigation block of a daily note: the days on either side of the one it
 * stands for, and the months around the month that day belongs to.
 *
 * The block only ever means something in a daily note; written anywhere else,
 * it says so rather than pointing at days that stand for nothing.
 */

import type { App, TFile } from "obsidian";

import { dailyNotesFolder } from "../daily-notes/vault-host";
import { dailyNoteDate, isInDailyNotesFolder } from "../daily-notes/notes";
import type { MyDailiesSettings } from "../settings/settings";
import { buildDailyNoteNavigation } from "./dashboard";
import { createNavigationRenderer, folderLabel, places, warning, WORDING } from "./render";

/** The language of the code block the navigation is written into. */
export const DAILY_NOTE_NAVIGATION_BLOCK = "my-dailies-daily-note-navigation";

/**
 * The Markdown the block comes to: the navigation of the daily note it sits
 * in, or the reason there is none to show.
 */
function blockMarkdown(
	app: App,
	settings: MyDailiesSettings,
	file: TFile,
	source: string,
): string {
	const date = dailyNoteDate(file.basename);
	const folder = dailyNotesFolder(app, settings);

	if (date === null) {
		return warning(
			`"${file.basename}" does not stand for a day. ` +
				"A daily note is named after one, such as 2026-08-29.",
		);
	}

	if (!isInDailyNotesFolder(file.path, folder)) {
		return warning(`This note is not in the daily notes folder, ${folderLabel(folder)}.`);
	}

	return buildDailyNoteNavigation(date, places(app, settings), WORDING, source);
}

/** Renders the navigation block of a daily note. */
export function createDailyNoteNavigationRenderer(
	app: App,
	settings: () => MyDailiesSettings,
): ReturnType<typeof createNavigationRenderer> {
	return createNavigationRenderer(app, settings, blockMarkdown);
}
