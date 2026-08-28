/*
 * Counting the tasks of a note that are still open.
 *
 * An open task is a line that starts with `- [ ] `: a task marker flush left,
 * with nothing but a space between the brackets. A task nested under another
 * one is indented and therefore not counted, and neither is a task whose
 * brackets hold anything at all — `- [x]`, `- [/]`, `- [-]` — which is how
 * Obsidian itself reads a task that is no longer open.
 */

/** A list item of a note, reduced to what the count needs. */
export interface TaskItem {
	/**
	 * The character between the brackets, or `null` when the item is not a task
	 * at all. A single space is the only thing that leaves a task open.
	 */
	status: string | null;
	/** The column the item starts at. Only the ones flush left are counted. */
	column: number;
}

/** Whether the item is a task that is still open. */
export function isOpenTask(item: TaskItem): boolean {
	return item.status === " " && item.column === 0;
}

/** How many tasks of the note are still open. */
export function countOpenTasks(items: TaskItem[]): number {
	return items.filter(isOpenTask).length;
}
