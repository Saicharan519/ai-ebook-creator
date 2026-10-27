import type { ImageType } from "../../lib/image-type";

/** Everything an exporter needs, already loaded and checked. */
export interface ExportBook {
  /** Stable id, used where a format needs a unique identifier (EPUB) */
  id: string;
  title: string;
  subtitle: string;
  author: string;
  updatedAt: Date;
  cover: { data: Buffer; type: ImageType } | null;
  chapters: { title: string; content: string }[];
}

/** The title shown for a chapter, falling back to its number */
export const chapterHeading = (chapter: { title: string }, index: number) =>
  chapter.title.trim() || `Chapter ${index + 1}`;
