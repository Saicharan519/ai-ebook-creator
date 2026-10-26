import { prisma } from "../../lib/db";
import { NotFoundError } from "../../lib/errors";

/** How much of the previous chapter's ending a chapter draft gets to see */
const PREVIOUS_ENDING_CHARS = 3_000;

export interface BookBrief {
  title: string;
  genre: string;
  premise: string;
  writingStyle: string;
  chapters: { title: string; description: string }[];
}

export interface ChapterBrief {
  position: number;
  title: string;
  description: string;
  previousChapterEnding: string;
}

/** The book's details and chapter list, if the user owns it. */
export async function loadBookBrief(userId: string, bookId: string): Promise<BookBrief> {
  const book = await prisma.book.findFirst({
    where: { id: bookId, ownerId: userId },
    include: {
      chapters: { orderBy: { position: "asc" }, select: { title: true, description: true } },
    },
  });
  if (!book) {
    throw new NotFoundError("Book not found");
  }
  return {
    title: book.title,
    genre: book.genre,
    premise: book.premise,
    writingStyle: book.writingStyle,
    chapters: book.chapters,
  };
}

/** The chapter being written, plus how the chapter before it ends. */
export async function loadChapterBrief(
  userId: string,
  bookId: string,
  chapterId: string,
): Promise<ChapterBrief> {
  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, bookId, book: { ownerId: userId } },
  });
  if (!chapter) {
    throw new NotFoundError("Chapter not found");
  }

  const previous =
    chapter.position > 0
      ? await prisma.chapter.findFirst({
          where: { bookId, position: chapter.position - 1 },
          select: { content: true },
        })
      : null;

  return {
    position: chapter.position,
    title: chapter.title,
    description: chapter.description,
    previousChapterEnding: previous?.content.slice(-PREVIOUS_ENDING_CHARS) ?? "",
  };
}
