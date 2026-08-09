import { findContentLines } from "../markdown/lines";
import type { FrameHeading } from "./types";

/**
 * An ATX heading of level two or three. The run of `#` characters must be
 * followed by a space, a tab or the end of the line, so `####` never matches.
 */
const HEADING_PATTERN = /^( {0,3})(#{2,3})(?:[ \t].*)?$/;

/**
 * Collects every level two and level three ATX heading of the document, skipping
 * YAML frontmatter and fenced code blocks.
 */
export function findFrameHeadings(source: string): FrameHeading[] {
	const headings: FrameHeading[] = [];

	for (const line of findContentLines(source)) {
		const heading = HEADING_PATTERN.exec(line.text);
		if (heading === null) {
			continue;
		}

		const hashes = heading[2];
		headings.push({
			level: hashes.length === 2 ? 2 : 3,
			line,
			contentStart: line.start + heading[1].length + hashes.length,
		});
	}

	return headings;
}
