/*
 * The navigation block of a monthly note: the month it stands for, with the
 * month before it and the month after it on either side.
 *
 * The months are found the way the daily note finds them — by the Monthly note
 * name setting — so that one template names every monthly note of the vault,
 * whichever note is pointing at it.
 */

import type { App, TFile } from "obsidian";

import { isInMonthlyNotesFolder, monthOfNoteName } from "../monthly-notes/vault-host";
import type { MyDailiesSettings } from "../settings/settings";
import { normalizeFolder } from "../settings/settings";
import { buildMonthlyNoteNavigation } from "./dashboard";
import { createNavigationRenderer, folderLabel, places, warning, WORDING } from "./render";

/** The language of the code block the navigation is written into. */
export const MONTHLY_NOTE_NAVIGATION_BLOCK = "my-dailies-monthly-note-navigation";

/**
 * The Markdown the block comes to: the navigation of the monthly note it sits
 * in, or the reason there is none to show.
 */
function blockMarkdown(
	app: App,
	settings: MyDailiesSettings,
	file: TFile,
	source: string,
): string {
	const month = monthOfNoteName(file.basename, settings.navigation.monthlyNoteName);
	const folder = normalizeFolder(settings.navigation.monthlyNotesFolder);

	if (month === null) {
		return warning(
			`"${file.basename}" does not stand for a month. A monthly note is named ` +
				`the way the Monthly note name setting writes one, ` +
				`"${settings.navigation.monthlyNoteName}".`,
		);
	}

	if (!isInMonthlyNotesFolder(file.path, folder)) {
		return warning(`This note is not in the monthly notes folder, ${folderLabel(folder)}.`);
	}

	return buildMonthlyNoteNavigation(month, places(app, settings), WORDING, source);
}

/** Renders the navigation block of a monthly note. */
export function createMonthlyNoteNavigationRenderer(
	app: App,
	settings: () => MyDailiesSettings,
): ReturnType<typeof createNavigationRenderer> {
	return createNavigationRenderer(app, settings, blockMarkdown);
}
