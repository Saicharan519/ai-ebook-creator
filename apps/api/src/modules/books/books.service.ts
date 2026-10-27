import type { Book, BookSummary, CreateBookInput, UpdateBookInput } from "@ebook/shared";
import {
  Prisma,
  type Book as BookRow,
  type Chapter as ChapterRow,
} from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { AppError, NotFoundError } from "../../lib/errors";
import { detectImageType } from "../../lib/image-type";
import { bookSlug } from "../../lib/slug";
import { storage } from "../../lib/storage";
import { toChapterSummaryDto } from "../chapters/chapters.dto";

type ChapterStats = Pick<ChapterRow, "wordCount">;

function toBookSummaryDto(book: BookRow, chapters: ChapterStats[]): BookSummary {
  return {
    id: book.id,
    title: book.title,
    subtitle: book.subtitle,
    author: book.author,
    genre: book.genre,
    status: book.status,
    coverUrl: book.coverKey ? storage.publicUrl(book.coverKey) : null,
    chapterCount: chapters.length,
    wordCount: chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
    createdAt: book.createdAt.toISOString(),
    updatedAt: book.updatedAt.toISOString(),
  };
}

function toBookDto(book: BookRow & { chapters: ChapterRow[] }): Book {
  return {
    ...toBookSummaryDto(book, book.chapters),
    premise: book.premise,
    writingStyle: book.writingStyle,
    slug: book.slug,
    publishedAt: book.publishedAt?.toISOString() ?? null,
    chapters: book.chapters.map(toChapterSummaryDto),
  };
}

/**
 * Loads a book only if it belongs to the user. A book owned by someone else
 * gets the same 404 as a missing one, so ids can't be probed for existence.
 */
export async function findOwnedBook(userId: string, bookId: string): Promise<BookRow> {
  const book = await prisma.book.findFirst({ where: { id: bookId, ownerId: userId } });
  if (!book) {
    throw new NotFoundError("Book not found");
  }
  return book;
}

export async function listBooks(userId: string): Promise<BookSummary[]> {
  const books = await prisma.book.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: "desc" },
    include: { chapters: { select: { wordCount: true } } },
  });
  return books.map((book) => toBookSummaryDto(book, book.chapters));
}

export async function getBook(userId: string, bookId: string): Promise<Book> {
  const book = await prisma.book.findFirst({
    where: { id: bookId, ownerId: userId },
    include: { chapters: { orderBy: { position: "asc" } } },
  });
  if (!book) {
    throw new NotFoundError("Book not found");
  }
  return toBookDto(book);
}

export async function createBook(userId: string, input: CreateBookInput): Promise<Book> {
  const book = await prisma.book.create({
    data: {
      ownerId: userId,
      ...input,
      // Start with one empty chapter so the editor always has somewhere to write
      chapters: { create: { title: "Chapter 1", position: 0 } },
    },
    include: { chapters: true },
  });
  return toBookDto(book);
}

export async function updateBook(
  userId: string,
  bookId: string,
  input: UpdateBookInput,
): Promise<Book> {
  await findOwnedBook(userId, bookId);
  await prisma.book.update({ where: { id: bookId }, data: input });
  return getBook(userId, bookId);
}

const SLUG_ATTEMPTS = 3;

/**
 * Makes the book readable at /read/<slug>. The slug is created on first
 * publish and kept afterwards, so republishing restores the same link.
 */
export async function publishBook(userId: string, bookId: string): Promise<Book> {
  const book = await findOwnedBook(userId, bookId);

  const written = await prisma.chapter.count({ where: { bookId, wordCount: { gt: 0 } } });
  if (written === 0) {
    throw new AppError(400, "NOTHING_TO_PUBLISH", "Write at least one chapter before publishing");
  }

  for (let attempt = 1; ; attempt++) {
    try {
      await prisma.book.update({
        where: { id: bookId },
        data: {
          status: "published",
          slug: book.slug ?? bookSlug(book.title),
          publishedAt: book.publishedAt ?? new Date(),
        },
      });
      break;
    } catch (error) {
      // A random suffix colliding is very unlikely, but cheap to handle
      const collided =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!collided || book.slug || attempt === SLUG_ATTEMPTS) throw error;
    }
  }
  return getBook(userId, bookId);
}

export async function unpublishBook(userId: string, bookId: string): Promise<Book> {
  await findOwnedBook(userId, bookId);
  await prisma.book.update({
    where: { id: bookId },
    data: { status: "draft", publishedAt: null },
  });
  return getBook(userId, bookId);
}

export async function deleteBook(userId: string, bookId: string): Promise<void> {
  const book = await findOwnedBook(userId, bookId);
  await prisma.book.delete({ where: { id: bookId } });
  if (book.coverKey) {
    await storage.delete(book.coverKey);
  }
}

export async function setCover(userId: string, bookId: string, data: Buffer): Promise<Book> {
  const book = await findOwnedBook(userId, bookId);

  const type = detectImageType(data);
  if (!type) {
    throw new AppError(400, "UNSUPPORTED_IMAGE", "Cover must be a JPEG or PNG image");
  }

  // A new key per upload, so browsers never show a cached old cover
  const key = `covers/${crypto.randomUUID()}.${type === "jpeg" ? "jpg" : "png"}`;
  await storage.save(key, data);
  await prisma.book.update({ where: { id: bookId }, data: { coverKey: key } });

  if (book.coverKey) {
    await storage.delete(book.coverKey);
  }
  return getBook(userId, bookId);
}

export async function removeCover(userId: string, bookId: string): Promise<Book> {
  const book = await findOwnedBook(userId, bookId);
  if (book.coverKey) {
    await prisma.book.update({ where: { id: bookId }, data: { coverKey: null } });
    await storage.delete(book.coverKey);
  }
  return getBook(userId, bookId);
}
