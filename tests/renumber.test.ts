import { describe, expect, it } from "vitest";

import {
	collectRenumberEdits,
	formatFrameNumber,
	renumberFrames,
} from "../src/renumber/edits";

/** Renumbers twice and asserts the second run is a no-op. */
function renumberStable(source: string): string {
	const once = renumberFrames(source);
	expect(renumberFrames(once)).toBe(once);
	return once;
}

describe("formatFrameNumber", () => {
	it("pads to at least two digits", () => {
		expect(formatFrameNumber(1)).toBe("01");
		expect(formatFrameNumber(9)).toBe("09");
		expect(formatFrameNumber(10)).toBe("10");
	});

	it("never truncates numbers above 99", () => {
		expect(formatFrameNumber(99)).toBe("99");
		expect(formatFrameNumber(100)).toBe("100");
		expect(formatFrameNumber(101)).toBe("101");
	});
});

describe("renumberFrames", () => {
	it("1. renumbers the example from the specification", () => {
		const source = [
			"## 02 BEE",
			"",
			"### 🎞️ 1",
			"",
			"some text",
			"",
			"### 🎞️ 08",
			"",
			"other text",
			"",
			"## 04 BUMBLE",
			"",
			"### 🎞️ 05",
			"",
			"more text",
			"",
			"### 🎞️ 11",
			"",
			"even more text",
			"",
		].join("\n");

		expect(renumberStable(source)).toBe(
			[
				"## 01 BEE",
				"",
				"### 🎞️ 01",
				"",
				"some text",
				"",
				"### 🎞️ 02",
				"",
				"other text",
				"",
				"## 02 BUMBLE",
				"",
				"### 🎞️ 01",
				"",
				"more text",
				"",
				"### 🎞️ 02",
				"",
				"even more text",
				"",
			].join("\n"),
		);
	});

	it("2. numbers several sections sequentially across the file", () => {
		const source = ["## 7 A", "## 7 B", "## 7 C", "## 7 D"].join("\n");

		expect(renumberStable(source)).toBe(
			["## 01 A", "## 02 B", "## 03 C", "## 04 D"].join("\n"),
		);
	});

	it("3. restarts frame numbering after every section", () => {
		const source = [
			"## 1 A",
			"### 4",
			"### 5",
			"### 6",
			"## 2 B",
			"### 9",
			"## 3 C",
			"### 1",
			"### 2",
		].join("\n");

		expect(renumberStable(source)).toBe(
			[
				"## 01 A",
				"### 01",
				"### 02",
				"### 03",
				"## 02 B",
				"### 01",
				"## 03 C",
				"### 01",
				"### 02",
			].join("\n"),
		);
	});

	it("4. pads numbers written without a leading zero", () => {
		expect(renumberStable("## 5 A\n### 3\n")).toBe("## 01 A\n### 01\n");
	});

	it("5. normalises numbers with several leading zeros", () => {
		expect(renumberStable("## 0007 A\n### 000\n### 00012\n")).toBe(
			"## 01 A\n### 01\n### 02\n",
		);
	});

	it("6. keeps all digits of numbers above 99", () => {
		const sections: string[] = [];
		for (let index = 0; index < 101; index += 1) {
			sections.push("## 1 Section");
		}

		const result = renumberStable(sections.join("\n")).split("\n");

		expect(result[0]).toBe("## 01 Section");
		expect(result[8]).toBe("## 09 Section");
		expect(result[9]).toBe("## 10 Section");
		expect(result[98]).toBe("## 99 Section");
		expect(result[99]).toBe("## 100 Section");
		expect(result[100]).toBe("## 101 Section");
	});

	it("7. leaves headings without a number untouched and skips them in the count", () => {
		const source = ["## 3 A", "### 🎞️ 05", "### Introduction", "### 🎞️ 20"].join("\n");

		expect(renumberStable(source)).toBe(
			["## 01 A", "### 🎞️ 01", "### Introduction", "### 🎞️ 02"].join("\n"),
		);
	});

	it("7b. ignores a section without a number", () => {
		const source = ["## 9 A", "### 4", "## Interlude", "### 7", "## 9 B", "### 4"].join(
			"\n",
		);

		expect(renumberStable(source)).toBe(
			["## 01 A", "### 01", "## Interlude", "### 02", "## 02 B", "### 01"].join("\n"),
		);
	});

	it("8. replaces only the first number of a heading", () => {
		const source = ["## 12 BEE 1999", "### 🎞️ 8 — version 2026", "### 🎞️ 3 of 42"].join(
			"\n",
		);

		expect(renumberStable(source)).toBe(
			["## 01 BEE 1999", "### 🎞️ 01 — version 2026", "### 🎞️ 02 of 42"].join("\n"),
		);
	});

	it("9. ignores headings inside fenced code blocks", () => {
		const source = [
			"## 5 A",
			"",
			"```markdown",
			"## 99 not a heading",
			"### 99 not a heading",
			"```",
			"",
			"### 7 real frame",
		].join("\n");

		expect(renumberStable(source)).toBe(
			[
				"## 01 A",
				"",
				"```markdown",
				"## 99 not a heading",
				"### 99 not a heading",
				"```",
				"",
				"### 01 real frame",
			].join("\n"),
		);
	});

	it("10. handles backtick and tilde fences, including nested and longer markers", () => {
		const source = [
			"## 5 A",
			"~~~",
			"## 99 tilde fenced",
			"~~~",
			"### 7 first",
			"````markdown",
			"```",
			"## 99 nested backticks",
			"```",
			"````",
			"### 8 second",
			"~~~~",
			"~~~",
			"### 99 nested tildes",
			"~~~",
			"~~~~",
			"### 9 third",
		].join("\n");

		expect(renumberStable(source)).toBe(
			[
				"## 01 A",
				"~~~",
				"## 99 tilde fenced",
				"~~~",
				"### 01 first",
				"````markdown",
				"```",
				"## 99 nested backticks",
				"```",
				"````",
				"### 02 second",
				"~~~~",
				"~~~",
				"### 99 nested tildes",
				"~~~",
				"~~~~",
				"### 03 third",
			].join("\n"),
		);
	});

	it("10b. treats an unclosed fence as running to the end of the document", () => {
		const source = ["## 5 A", "```", "### 99 still code", "## 99 still code"].join("\n");

		expect(renumberStable(source)).toBe(
			["## 01 A", "```", "### 99 still code", "## 99 still code"].join("\n"),
		);
	});

	it("11. ignores headings inside YAML frontmatter", () => {
		const source = [
			"---",
			"title: Deck",
			"## 99 not a heading",
			"---",
			"",
			"## 5 A",
			"### 7 frame",
		].join("\n");

		expect(renumberStable(source)).toBe(
			[
				"---",
				"title: Deck",
				"## 99 not a heading",
				"---",
				"",
				"## 01 A",
				"### 01 frame",
			].join("\n"),
		);
	});

	it("11b. does not treat a thematic break in the body as frontmatter", () => {
		const source = ["Intro", "", "---", "", "## 5 A", "### 7 frame"].join("\n");

		expect(renumberStable(source)).toBe(
			["Intro", "", "---", "", "## 01 A", "### 01 frame"].join("\n"),
		);
	});

	it("11c. does not treat an unterminated frontmatter block as frontmatter", () => {
		expect(renumberStable("---\n## 5 A\n### 7 frame")).toBe("---\n## 01 A\n### 01 frame");
	});

	it("12. ignores headings of other levels", () => {
		const source = [
			"# 9 Title",
			"## 9 Section",
			"#### 9 Sub frame",
			"##### 9 Deeper",
			"###9 no space",
			"##9 no space",
		].join("\n");

		expect(renumberStable(source)).toBe(
			[
				"# 9 Title",
				"## 01 Section",
				"#### 9 Sub frame",
				"##### 9 Deeper",
				"###9 no space",
				"##9 no space",
			].join("\n"),
		);
	});

	it("13. leaves a document without matching headings untouched", () => {
		const source = "Just text with 12 numbers and 34 more.\n\n- 56 list item\n";

		expect(renumberFrames(source)).toBe(source);
		expect(collectRenumberEdits(source)).toEqual([]);
	});

	it("14. leaves frames placed before the first numbered section untouched", () => {
		const source = ["### 🎞️ 7", "### 🎞️ 8", "## 5 A", "### 🎞️ 9"].join("\n");

		expect(renumberStable(source)).toBe(
			["### 🎞️ 7", "### 🎞️ 8", "## 01 A", "### 🎞️ 01"].join("\n"),
		);
	});

	it("15. preserves CRLF line breaks", () => {
		const source = "## 5 A\r\n\r\n### 7 frame\r\n\r\n### 9 frame\r\n";

		expect(renumberStable(source)).toBe("## 01 A\r\n\r\n### 01 frame\r\n\r\n### 02 frame\r\n");
	});

	it("15b. preserves LF line breaks and the final newline", () => {
		expect(renumberStable("## 5 A\n### 7 frame\n")).toBe("## 01 A\n### 01 frame\n");
		expect(renumberStable("## 5 A\n### 7 frame")).toBe("## 01 A\n### 01 frame");
	});

	it("16. is idempotent on an already renumbered document", () => {
		const source = [
			"## 01 A",
			"### 01 frame",
			"### 02 frame",
			"## 02 B",
			"### 01 frame",
		].join("\n");

		expect(collectRenumberEdits(source)).toEqual([]);
		expect(renumberFrames(source)).toBe(source);
	});

	it("keeps emoji, case, punctuation and spacing of the heading text", () => {
		const source = "##\t12\tBEE — Ünïcodé  ✨  (v2)\n###   🎞️   8   —   ok\n";

		expect(renumberStable(source)).toBe(
			"##\t01\tBEE — Ünïcodé  ✨  (v2)\n###   🎞️   01   —   ok\n",
		);
	});

	it("accepts up to three spaces of indentation", () => {
		expect(renumberStable("   ## 9 A\n   ### 9 frame\n")).toBe(
			"   ## 01 A\n   ### 01 frame\n",
		);
	});

	it("returns sorted, non-overlapping edits", () => {
		const edits = collectRenumberEdits("## 5 A\n### 7 frame\n### 9 frame\n");

		expect(edits).toEqual([
			{ start: 3, end: 4, text: "01" },
			{ start: 11, end: 12, text: "01" },
			{ start: 23, end: 24, text: "02" },
		]);
	});
});
