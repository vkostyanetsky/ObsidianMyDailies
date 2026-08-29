/*
 * Open tasks as a metric of a daily note: how many of the note's own tasks are
 * still to be done.
 *
 * The tasks are taken from the index Obsidian keeps, not from the text of the
 * note, so a run over the whole vault reads no file at all — and a `- [ ] `
 * inside a fenced code block is not mistaken for a task, because Obsidian does
 * not index it as one either.
 */

import type { App } from "obsidian";

import type { DayMetric, DayMetricSource } from "../daily-notes/metrics";
import type { MyDailiesSettings } from "../settings/settings";
import type { TaskItem } from "./open-tasks";
import { countOpenTasks } from "./open-tasks";

/** The list items of a note, as the count needs them. */
function taskItems(app: App, path: string): TaskItem[] {
	const file = app.vault.getFileByPath(path);

	if (file === null) {
		return [];
	}

	const items = app.metadataCache.getFileCache(file)?.listItems ?? [];

	return items.map((item) => ({
		status: item.task ?? null,
		column: item.position.start.col,
	}));
}

function openMetric(app: App, property: string): DayMetric {
	return {
		measure: (note) => {
			const open = countOpenTasks(taskItems(app, note.path));

			return {
				values: { [property]: open },
				summary: `${open} open ${open === 1 ? "task" : "tasks"}`,
			};
		},
	};
}

/** The open tasks metric, or `null` when it is switched off. */
export function createOpenTasksMetric(app: App, settings: MyDailiesSettings): DayMetricSource | null {
	if (!settings.openTasks.enabled) {
		return null;
	}

	const property = settings.openTasks.property;

	return {
		id: "open-tasks",
		properties: [property],
		open: () => openMetric(app, property),
	};
}
