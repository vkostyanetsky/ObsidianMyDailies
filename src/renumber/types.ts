import type { DocumentLine } from "../markdown/lines";

/** A section (`##`) or frame (`###`) heading found in the document. */
export interface FrameHeading {
	/** Heading level: 2 for sections, 3 for frames. */
	level: 2 | 3;
	/** The line the heading occupies. */
	line: DocumentLine;
	/** Offset of the heading content, i.e. right after the run of `#` characters. */
	contentStart: number;
}
