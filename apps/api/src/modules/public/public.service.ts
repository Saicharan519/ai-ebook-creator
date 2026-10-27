import type { PublicBook, PublicChapter } from "@ebook/shared";
import { prisma } from "../../lib/db";
import { NotFoundError } from "../../lib/errors";
import { storage } from "../../lib/storage";

/**
 * Only published books, and only chapters with text: planned-but-empty
 * chapters aren't part of what the author shared.
 */
async function findPublishedBook(slug: string) {
  const book = await prisma.book.findFirst({
    where: { slug, status: "published" },
    include: {
      chapters: {
        where: { wordCount: { gt: 0 } },
        orderBy: { position: "asc" },
        select: { id: true, title: true, wordCount: true },
      },
    },
  });
  if (!book || !book.publishedAt) {
    throw new NotFoundError("Book not found");
  }
  return book;
}

const chapterTitle = (chapter: { title: string }, index: number) =>
  chapter.title.trim() || `Chapter ${index + 1}`;

export async function getPublicBook(slug: string): Promise<PublicBook> {
  const book = await findPublishedBook(slug);
  return {
    slug,
    title: book.title,
    subtitle: book.subtitle,
    author: book.author,
    genre: book.genre,
    coverUrl: book.coverKey ? storage.publicUrl(book.coverKey) : null,
    publishedAt: book.publishedAt!.toISOString(),
    wordCount: book.chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
    chapters: book.chapters.map((chapter, i) => ({
      id: chapter.id,
      title: chapterTitle(chapter, i),
      wordCount: chapter.wordCount,
    })),
  };
}

export async function getPublicChapter(slug: string, chapterId: string): Promise<PublicChapter> {
  const book = await findPublishedBook(slug);
  const index = book.chapters.findIndex((chapter) => chapter.id === chapterId);
  if (index === -1) {
    throw new NotFoundError("Chapter not found");
  }

  const chapter = await prisma.chapter.findUniqueOrThrow({
    where: { id: chapterId },
    select: { content: true },
  });
  const link = (i: number) => {
    const target = book.chapters[i];
    return target ? { id: target.id, title: chapterTitle(target, i) } : null;
  };

  return {
    id: chapterId,
    title: chapterTitle(book.chapters[index]!, index),
    number: index + 1,
    content: chapter.content,
    previous: link(index - 1),
    next: link(index + 1),
  };
}
