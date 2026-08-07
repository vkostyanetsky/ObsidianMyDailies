import { findFrameHeadings } from "./scanner";
import type { FrameHeading, TextEdit } from "./types";

/** The first unsigned decimal integer of a heading's content. */
const NUMBER_PATTERN = /\d+/;

interface HeadingNumber {
	/** Offset of the first digit within the source. */
	start: number;
	/** Offset just past the last digit within the source. */
	end: number;
	/** The digits as they are currently written. */
	text: string;
}

/** Formats a frame number with at least two digits, never truncating it. */
export function formatFrameNumber(value: number): string {
	return String(value).padStart(2, "0");
}

function findHeadingNumber(heading: FrameHeading): HeadingNumber | null {
	const contentOffset = heading.contentStart - heading.line.start;
	const content = heading.line.text.slice(contentOffset);
	const match = NUMBER_PATTERN.exec(content);

	if (match === null) {
		return null;
	}

	const start = heading.contentStart + match.index;

	return { start, end: start + match[0].length, text: match[0] };
}

/**
 * Computes the replacements that renumber section (`##`) and frame (`###`)
 * headings of a Markdown document.
 *
 * Sections are numbered sequentially across the whole document; frames are
 * numbered sequentially within their section and restart at `01` on every new
 * section. Headings without a number are left untouched and do not consume a
 * number, and frames preceding the first numbered section are ignored.
 *
 * The returned edits are non-overlapping and sorted by ascending offset.
 */
export function collectRenumberEdits(source: string): TextEdit[] {
	const edits: TextEdit[] = [];
	let sectionNumber = 0;
	let frameNumber = 0;
	let insideSection = false;

	for (const heading of findFrameHeadings(source)) {
		const current = findHeadingNumber(heading);
		if (current === null) {
			continue;
		}

		let value: number;

		if (heading.level === 2) {
			sectionNumber += 1;
			frameNumber = 0;
			insideSection = true;
			value = sectionNumber;
		} else {
			if (!insideSection) {
				continue;
			}
			frameNumber += 1;
			value = frameNumber;
		}

		const text = formatFrameNumber(value);
		if (text !== current.text) {
			edits.push({ start: current.start, end: current.end, text });
		}
	}

	return edits;
}

/** Applies edits to a string. Edits must be sorted and non-overlapping. */
export function applyTextEdits(source: string, edits: TextEdit[]): string {
	let result = source;

	// Apply from the end so that earlier offsets stay valid.
	for (let index = edits.length - 1; index >= 0; index -= 1) {
		const edit = edits[index];
		result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
	}

	return result;
}

/**
 * Returns the document with renumbered section and frame headings. Everything
 * else, including line breaks, is preserved verbatim.
 */
export function renumberFrames(source: string): string {
	return applyTextEdits(source, collectRenumberEdits(source));
}
