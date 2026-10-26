import { createBookInputSchema, updateBookInputSchema } from "@ebook/shared";
import { Router } from "express";
import multer from "multer";
import { AppError } from "../../lib/errors";
import { idParam } from "../../lib/params";
import { currentUserId } from "../../middleware/require-auth";
import * as booksService from "./books.service";

export const MAX_COVER_BYTES = 2 * 1024 * 1024;

// Memory storage: the file is checked (type, size) before anything touches disk
const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_COVER_BYTES, files: 1 },
});

/** Mounted at /books, behind requireAuth */
export const booksRouter = Router();

booksRouter.get("/", async (req, res) => {
  res.json(await booksService.listBooks(currentUserId(req)));
});

booksRouter.post("/", async (req, res) => {
  const input = createBookInputSchema.parse(req.body);
  res.status(201).json(await booksService.createBook(currentUserId(req), input));
});

booksRouter.get("/:bookId", async (req, res) => {
  const bookId = idParam(req.params.bookId, "Book");
  res.json(await booksService.getBook(currentUserId(req), bookId));
});

booksRouter.patch("/:bookId", async (req, res) => {
  const bookId = idParam(req.params.bookId, "Book");
  const input = updateBookInputSchema.parse(req.body);
  res.json(await booksService.updateBook(currentUserId(req), bookId, input));
});

booksRouter.delete("/:bookId", async (req, res) => {
  const bookId = idParam(req.params.bookId, "Book");
  await booksService.deleteBook(currentUserId(req), bookId);
  res.status(204).end();
});

booksRouter.put("/:bookId/cover", coverUpload.single("cover"), async (req, res) => {
  const bookId = idParam(req.params.bookId, "Book");
  if (!req.file) {
    throw new AppError(400, "VALIDATION_ERROR", 'Attach the image as a "cover" file field');
  }
  res.json(await booksService.setCover(currentUserId(req), bookId, req.file.buffer));
});

booksRouter.delete("/:bookId/cover", async (req, res) => {
  const bookId = idParam(req.params.bookId, "Book");
  res.json(await booksService.removeCover(currentUserId(req), bookId));
});
