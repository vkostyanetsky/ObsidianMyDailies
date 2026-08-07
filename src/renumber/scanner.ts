import type { DocumentLine, FrameHeading } from "./types";

/**
 * A fenced code block delimiter: three or more backticks or tildes, indented by
 * at most three spaces, followed by an info string.
 */
const FENCE_PATTERN = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/** A closing YAML frontmatter delimiter. */
const FRONTMATTER_DELIMITER_PATTERN = /^---[ \t]*$/;

/**
 * An ATX heading of level two or three. The run of `#` characters must be
 * followed by a space, a tab or the end of the line, so `####` never matches.
 */
const HEADING_PATTERN = /^( {0,3})(#{2,3})(?:[ \t].*)?$/;

interface Fence {
	/** Either a backtick or a tilde. */
	marker: string;
	/** Number of marker characters the closing delimiter has to match. */
	length: number;
	/** Text following the delimiter on the opening line. */
	info: string;
}

/** Splits the source into lines, preserving offsets and any kind of line break. */
export function splitLines(source: string): DocumentLine[] {
	const lines: DocumentLine[] = [];
	const lineBreakPattern = /\r\n|\n|\r/g;
	let start = 0;
	let index = 0;
	let lineBreak: RegExpExecArray | null;

	while ((lineBreak = lineBreakPattern.exec(source)) !== null) {
		lines.push({ index, start, text: source.slice(start, lineBreak.index) });
		index += 1;
		start = lineBreak.index + lineBreak[0].length;
	}

	lines.push({ index, start, text: source.slice(start) });

	return lines;
}

function parseFence(text: string): Fence | null {
	const match = FENCE_PATTERN.exec(text);
	if (match === null) {
		return null;
	}

	return { marker: match[1][0], length: match[1].length, info: match[2] };
}

function canOpenFence(fence: Fence): boolean {
	// A backtick fence cannot carry backticks in its info string, otherwise
	// inline code such as ```` ```code``` ```` would open a block.
	return fence.marker !== "`" || !fence.info.includes("`");
}

function closesFence(candidate: Fence, open: Fence): boolean {
	return (
		candidate.marker === open.marker &&
		candidate.length >= open.length &&
		candidate.info.trim() === ""
	);
}

/**
 * Returns the index of the line closing the YAML frontmatter, or `-1` when the
 * document does not start with a complete frontmatter block.
 */
function findFrontmatterEnd(lines: DocumentLine[]): number {
	if (lines.length === 0 || lines[0].text !== "---") {
		return -1;
	}

	for (let index = 1; index < lines.length; index += 1) {
		if (FRONTMATTER_DELIMITER_PATTERN.test(lines[index].text)) {
			return index;
		}
	}

	// An unterminated block is not frontmatter — treat it as regular content.
	return -1;
}

/**
 * Collects every level two and level three ATX heading of the document, skipping
 * YAML frontmatter and fenced code blocks.
 */
export function findFrameHeadings(source: string): FrameHeading[] {
	const lines = splitLines(source);
	const headings: FrameHeading[] = [];
	let openFence: Fence | null = null;

	for (let index = findFrontmatterEnd(lines) + 1; index < lines.length; index += 1) {
		const line = lines[index];
		const fence = parseFence(line.text);

		if (openFence !== null) {
			if (fence !== null && closesFence(fence, openFence)) {
				openFence = null;
			}
			continue;
		}

		if (fence !== null && canOpenFence(fence)) {
			openFence = fence;
			continue;
		}

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
