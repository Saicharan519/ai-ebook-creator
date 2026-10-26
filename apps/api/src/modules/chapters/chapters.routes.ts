import {
  addChaptersInputSchema,
  createChapterInputSchema,
  reorderChaptersInputSchema,
  updateChapterInputSchema,
} from "@ebook/shared";
import { Router } from "express";
import { idParam } from "../../lib/params";
import { currentUserId } from "../../middleware/require-auth";
import * as chaptersService from "./chapters.service";

/** Mounted at /books, behind requireAuth */
export const chaptersRouter = Router();

chaptersRouter.post("/:bookId/chapters", async (req, res) => {
  const bookId = idParam(req.params.bookId, "Book");
  const input = createChapterInputSchema.parse(req.body);
  res.status(201).json(await chaptersService.createChapter(currentUserId(req), bookId, input));
});

chaptersRouter.post("/:bookId/chapters/batch", async (req, res) => {
  const bookId = idParam(req.params.bookId, "Book");
  const input = addChaptersInputSchema.parse(req.body);
  res.status(201).json(await chaptersService.addChapters(currentUserId(req), bookId, input));
});

// Declared before /:chapterId so "order" isn't treated as a chapter id
chaptersRouter.patch("/:bookId/chapters/order", async (req, res) => {
  const bookId = idParam(req.params.bookId, "Book");
  const { chapterIds } = reorderChaptersInputSchema.parse(req.body);
  res.json(await chaptersService.reorderChapters(currentUserId(req), bookId, chapterIds));
});

chaptersRouter.get("/:bookId/chapters/:chapterId", async (req, res) => {
  const bookId = idParam(req.params.bookId, "Book");
  const chapterId = idParam(req.params.chapterId, "Chapter");
  res.json(await chaptersService.getChapter(currentUserId(req), bookId, chapterId));
});

chaptersRouter.patch("/:bookId/chapters/:chapterId", async (req, res) => {
  const bookId = idParam(req.params.bookId, "Book");
  const chapterId = idParam(req.params.chapterId, "Chapter");
  const input = updateChapterInputSchema.parse(req.body);
  res.json(await chaptersService.updateChapter(currentUserId(req), bookId, chapterId, input));
});

chaptersRouter.delete("/:bookId/chapters/:chapterId", async (req, res) => {
  const bookId = idParam(req.params.bookId, "Book");
  const chapterId = idParam(req.params.chapterId, "Chapter");
  await chaptersService.deleteChapter(currentUserId(req), bookId, chapterId);
  res.status(204).end();
});
