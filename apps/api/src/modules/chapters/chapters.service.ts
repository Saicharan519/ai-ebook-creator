import {
  countWords,
  type AddChaptersInput,
  type Chapter,
  type ChapterSummary,
  type CreateChapterInput,
  type UpdateChapterInput,
} from "@ebook/shared";
import { prisma } from "../../lib/db";
import { AppError, NotFoundError } from "../../lib/errors";
import { findOwnedBook } from "../books/books.service";
import { toChapterDto, toChapterSummaryDto } from "./chapters.dto";

async function findOwnedChapter(userId: string, bookId: string, chapterId: string) {
  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, bookId, book: { ownerId: userId } },
  });
  if (!chapter) {
    throw new NotFoundError("Chapter not found");
  }
  return chapter;
}

/** Editing a chapter counts as editing its book, so the dashboard sorts it to the top. */
function touchBook(bookId: string) {
  return prisma.book.update({ where: { id: bookId }, data: { updatedAt: new Date() } });
}

export async function getChapter(userId: string, bookId: string, chapterId: string) {
  return toChapterDto(await findOwnedChapter(userId, bookId, chapterId));
}

export async function createChapter(
  userId: string,
  bookId: string,
  input: CreateChapterInput,
): Promise<Chapter> {
  await findOwnedBook(userId, bookId);

  const chapter = await prisma.$transaction(async (tx) => {
    const count = await tx.chapter.count({ where: { bookId } });
    const created = await tx.chapter.create({
      data: {
        bookId,
        position: count,
        title: input.title ?? `Chapter ${count + 1}`,
        description: input.description ?? "",
        content: input.content ?? "",
        wordCount: countWords(input.content ?? ""),
      },
    });
    await tx.book.update({ where: { id: bookId }, data: { updatedAt: new Date() } });
    return created;
  });

  return toChapterDto(chapter);
}

/**
 * Appends several chapters at once, e.g. from an AI outline. With `replaceEmpty`,
 * existing chapters are removed first, but only if none of them has any text.
 */
export async function addChapters(
  userId: string,
  bookId: string,
  input: AddChaptersInput,
): Promise<ChapterSummary[]> {
  await findOwnedBook(userId, bookId);

  await prisma.$transaction(async (tx) => {
    if (input.replaceEmpty) {
      const hasText = await tx.chapter.count({ where: { bookId, NOT: { content: "" } } });
      if (hasText === 0) {
        await tx.chapter.deleteMany({ where: { bookId } });
      }
    }
    const count = await tx.chapter.count({ where: { bookId } });
    await tx.chapter.createMany({
      data: input.chapters.map((chapter, i) => ({
        bookId,
        position: count + i,
        title: chapter.title,
        description: chapter.description,
      })),
    });
    await tx.book.update({ where: { id: bookId }, data: { updatedAt: new Date() } });
  });

  const chapters = await prisma.chapter.findMany({
    where: { bookId },
    orderBy: { position: "asc" },
  });
  return chapters.map(toChapterSummaryDto);
}

export async function updateChapter(
  userId: string,
  bookId: string,
  chapterId: string,
  input: UpdateChapterInput,
): Promise<Chapter> {
  await findOwnedChapter(userId, bookId, chapterId);

  const [chapter] = await prisma.$transaction([
    prisma.chapter.update({
      where: { id: chapterId },
      data: {
        ...input,
        ...(input.content !== undefined && { wordCount: countWords(input.content) }),
      },
    }),
    touchBook(bookId),
  ]);

  return toChapterDto(chapter);
}

export async function deleteChapter(userId: string, bookId: string, chapterId: string) {
  await findOwnedChapter(userId, bookId, chapterId);

  await prisma.$transaction(async (tx) => {
    await tx.chapter.delete({ where: { id: chapterId } });
    // Close the gap so positions stay 0..n-1
    const remaining = await tx.chapter.findMany({
      where: { bookId },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    await Promise.all(
      remaining.map(({ id }, position) => tx.chapter.update({ where: { id }, data: { position } })),
    );
    await tx.book.update({ where: { id: bookId }, data: { updatedAt: new Date() } });
  });
}

/** Sets the chapter order. `chapterIds` must list every chapter of the book exactly once. */
export async function reorderChapters(
  userId: string,
  bookId: string,
  chapterIds: string[],
): Promise<ChapterSummary[]> {
  await findOwnedBook(userId, bookId);

  const existing = await prisma.chapter.findMany({ where: { bookId }, select: { id: true } });
  const existingIds = new Set(existing.map(({ id }) => id));
  const isPermutation =
    chapterIds.length === existingIds.size &&
    new Set(chapterIds).size === chapterIds.length &&
    chapterIds.every((id) => existingIds.has(id));

  if (!isPermutation) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "chapterIds must contain every chapter of the book exactly once",
    );
  }

  await prisma.$transaction([
    ...chapterIds.map((id, position) =>
      prisma.chapter.update({ where: { id }, data: { position } }),
    ),
    touchBook(bookId),
  ]);

  const chapters = await prisma.chapter.findMany({
    where: { bookId },
    orderBy: { position: "asc" },
  });
  return chapters.map(toChapterSummaryDto);
}
