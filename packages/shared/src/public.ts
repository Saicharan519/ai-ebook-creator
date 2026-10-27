import { z } from "zod";

const chapterLink = z.object({ id: z.uuid(), title: z.string() });

/** A published book as anyone can see it: no premise notes, drafts, or ids of other data */
export const publicBookSchema = z.object({
  slug: z.string(),
  title: z.string(),
  subtitle: z.string(),
  author: z.string(),
  genre: z.string(),
  coverUrl: z.url().nullable(),
  publishedAt: z.iso.datetime(),
  wordCount: z.int().nonnegative(),
  chapters: z.array(chapterLink.extend({ wordCount: z.int().nonnegative() })),
});

export const publicChapterSchema = chapterLink.extend({
  /** 1-based number among the published chapters */
  number: z.int().positive(),
  content: z.string(),
  previous: chapterLink.nullable(),
  next: chapterLink.nullable(),
});

export type PublicBook = z.infer<typeof publicBookSchema>;
export type PublicChapter = z.infer<typeof publicChapterSchema>;
