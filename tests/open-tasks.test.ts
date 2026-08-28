import { describe, expect, it } from "vitest";

import type { TaskItem } from "../src/tasks/open-tasks";
import { countOpenTasks, isOpenTask } from "../src/tasks/open-tasks";

/** A list item as Obsidian indexes it. */
function item(status: string | null, column = 0): TaskItem {
	return { status, column };
}

describe("isOpenTask", () => {
	it("takes a task flush left with nothing but a space in its brackets", () => {
		expect(isOpenTask(item(" "))).toBe(true);
	});

	it("leaves a task that is no longer open out, whatever marks it", () => {
		expect(isOpenTask(item("x"))).toBe(false);
		expect(isOpenTask(item("X"))).toBe(false);
		expect(isOpenTask(item("/"))).toBe(false);
		expect(isOpenTask(item("-"))).toBe(false);
	});

	it("leaves a list item that is not a task out", () => {
		expect(isOpenTask(item(null))).toBe(false);
	});

	it("leaves a task nested under another one out", () => {
		expect(isOpenTask(item(" ", 1))).toBe(false);
		expect(isOpenTask(item(" ", 4))).toBe(false);
	});
});

describe("countOpenTasks", () => {
	it("counts the open ones and nothing else", () => {
		const items = [
			item(" "),
			item("x"),
			item(" "),
			item(null),
			item(" ", 1),
			item("x", 1),
			item(" "),
		];

		expect(countOpenTasks(items)).toBe(3);
	});

	it("comes out at nothing for a note without tasks", () => {
		expect(countOpenTasks([])).toBe(0);
		expect(countOpenTasks([item(null), item(null)])).toBe(0);
	});

	it("comes out at nothing for a note whose tasks are all done", () => {
		expect(countOpenTasks([item("x"), item("x")])).toBe(0);
	});
});
