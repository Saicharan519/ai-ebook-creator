import { Router } from "express";
import { prisma } from "../../lib/db";
import { NotFoundError } from "../../lib/errors";
import { detectImageType } from "../../lib/image-type";
import { idParam } from "../../lib/params";
import { storage } from "../../lib/storage";
import { currentUserId } from "../../middleware/require-auth";
import { renderDocx } from "./docx-renderer";
import { renderEpub } from "./epub-renderer";
import type { ExportBook } from "./export-book";
import { renderPdf } from "./pdf-renderer";

const FORMATS = {
  pdf: { render: renderPdf, contentType: "application/pdf" },
  docx: {
    render: renderDocx,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  epub: { render: renderEpub, contentType: "application/epub+zip" },
} as const;

type Format = keyof typeof FORMATS;
const isFormat = (value: string): value is Format => Object.hasOwn(FORMATS, value);

async function loadExportBook(userId: string, bookId: string): Promise<ExportBook> {
  const book = await prisma.book.findFirst({
    where: { id: bookId, ownerId: userId },
    include: { chapters: { orderBy: { position: "asc" } } },
  });
  if (!book) {
    throw new NotFoundError("Book not found");
  }

  // The type was checked on upload; checking again guards against a missing or replaced file
  const coverData = book.coverKey ? await storage.read(book.coverKey) : null;
  const coverType = coverData ? detectImageType(coverData) : null;

  return {
    id: book.id,
    title: book.title,
    subtitle: book.subtitle,
    author: book.author,
    updatedAt: book.updatedAt,
    cover: coverData && coverType ? { data: coverData, type: coverType } : null,
    chapters: book.chapters.map(({ title, content }) => ({ title, content })),
  };
}

/** Mounted at /books, behind requireAuth */
export const exportRouter = Router();

exportRouter.get("/:bookId/export/:format", async (req, res) => {
  const bookId = idParam(req.params.bookId, "Book");
  const format = req.params.format;
  if (!isFormat(format)) {
    throw new NotFoundError("Export format not supported");
  }

  const book = await loadExportBook(currentUserId(req), bookId);
  const { render, contentType } = FORMATS[format];
  const file = await render(book);

  res.type(contentType);
  // res.attachment encodes non-ASCII titles safely (RFC 6266 filename*)
  res.attachment(`${book.title}.${format}`);
  res.send(file);
});
