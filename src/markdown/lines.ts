/** A single line of a Markdown document together with its absolute offset. */
export interface DocumentLine {
	/** Zero-based line index. */
	index: number;
	/** Offset of the first character of the line within the source. */
	start: number;
	/** Line content without its trailing line break. */
	text: string;
}

/** A closing YAML frontmatter delimiter. */
const FRONTMATTER_DELIMITER_PATTERN = /^---[ \t]*$/;

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

/** The lines a YAML frontmatter block is made of, delimiters left out. */
export interface FrontmatterRange {
	/** Index of the first line of the body, just past the opening `---`. */
	start: number;
	/** Index of the closing `---`, that is one past the last body line. */
	end: number;
}

/**
 * Returns the body of the YAML frontmatter, or `null` when the document does
 * not start with a complete block.
 */
export function findFrontmatterRange(lines: DocumentLine[]): FrontmatterRange | null {
	if (lines.length === 0 || lines[0].text !== "---") {
		return null;
	}

	for (let index = 1; index < lines.length; index += 1) {
		if (FRONTMATTER_DELIMITER_PATTERN.test(lines[index].text)) {
			return { start: 1, end: index };
		}
	}

	// An unterminated block is not frontmatter — treat it as regular content.
	return null;
}
