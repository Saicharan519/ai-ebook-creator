import { z } from "zod";

export const bookStatusSchema = z.enum(["draft", "published"]);

const title = z.string().trim().min(1, "Title is required").max(200);
// About 80k words; generous for one chapter, and keeps requests under the 1 MB body limit
export const CHAPTER_CONTENT_MAX = 500_000;

// ---- Inputs ----

export const createBookInputSchema = z.object({
  title,
  subtitle: z.string().trim().max(300).optional(),
  author: z.string().trim().min(1, "Author is required").max(100),
  genre: z.string().trim().max(100).optional(),
  premise: z.string().trim().max(5_000).optional(),
  writingStyle: z.string().trim().max(500).optional(),
});

export const updateBookInputSchema = createBookInputSchema
  .partial()
  .extend({ status: bookStatusSchema.optional() });

export const createChapterInputSchema = z.object({
  title: title.optional(),
  description: z.string().trim().max(2_000).optional(),
  content: z.string().max(CHAPTER_CONTENT_MAX).optional(),
});

export const updateChapterInputSchema = z.object({
  title: title.optional(),
  description: z.string().trim().max(2_000).optional(),
  content: z.string().max(CHAPTER_CONTENT_MAX).optional(),
});

export const reorderChaptersInputSchema = z.object({
  chapterIds: z.array(z.uuid()).min(1),
});

// ---- Responses ----

export const chapterSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  position: z.number().int().nonnegative(),
  wordCount: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(),
});

export const chapterSchema = chapterSummarySchema.extend({
  bookId: z.uuid(),
  content: z.string(),
  createdAt: z.iso.datetime(),
});

export const bookSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  subtitle: z.string(),
  author: z.string(),
  genre: z.string(),
  status: bookStatusSchema,
  coverUrl: z.url().nullable(),
  chapterCount: z.number().int().nonnegative(),
  wordCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const bookSchema = bookSummarySchema.extend({
  premise: z.string(),
  writingStyle: z.string(),
  chapters: z.array(chapterSummarySchema),
});

export type BookStatus = z.infer<typeof bookStatusSchema>;
export type CreateBookInput = z.infer<typeof createBookInputSchema>;
export type UpdateBookInput = z.infer<typeof updateBookInputSchema>;
export type CreateChapterInput = z.infer<typeof createChapterInputSchema>;
export type UpdateChapterInput = z.infer<typeof updateChapterInputSchema>;
export type ReorderChaptersInput = z.infer<typeof reorderChaptersInputSchema>;
export type ChapterSummary = z.infer<typeof chapterSummarySchema>;
export type Chapter = z.infer<typeof chapterSchema>;
export type BookSummary = z.infer<typeof bookSummarySchema>;
export type Book = z.infer<typeof bookSchema>;

/** Rough word count of Markdown text: whitespace-separated tokens that contain a letter or digit. */
export function countWords(markdown: string): number {
  return markdown.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}
