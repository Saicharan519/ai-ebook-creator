import type { Chapter, ChapterSummary } from "@ebook/shared";
import type { Chapter as ChapterRow } from "../../generated/prisma/client";

export function toChapterSummaryDto(chapter: ChapterRow): ChapterSummary {
  return {
    id: chapter.id,
    title: chapter.title,
    description: chapter.description,
    position: chapter.position,
    wordCount: chapter.wordCount,
    updatedAt: chapter.updatedAt.toISOString(),
  };
}

export function toChapterDto(chapter: ChapterRow): Chapter {
  return {
    ...toChapterSummaryDto(chapter),
    bookId: chapter.bookId,
    content: chapter.content,
    createdAt: chapter.createdAt.toISOString(),
  };
}
