/** A single line of a Markdown document together with its absolute offset. */
export interface DocumentLine {
	/** Zero-based line index. */
	index: number;
	/** Offset of the first character of the line within the source. */
	start: number;
	/** Line content without its trailing line break. */
	text: string;
}

/** A section (`##`) or frame (`###`) heading found in the document. */
export interface FrameHeading {
	/** Heading level: 2 for sections, 3 for frames. */
	level: 2 | 3;
	/** The line the heading occupies. */
	line: DocumentLine;
	/** Offset of the heading content, i.e. right after the run of `#` characters. */
	contentStart: number;
}

/** A replacement of the `[start, end)` range of the source with `text`. */
export interface TextEdit {
	start: number;
	end: number;
	text: string;
}
