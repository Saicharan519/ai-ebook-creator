import {
  addChaptersInputSchema,
  createChapterInputSchema,
  reorderChaptersInputSchema,
  updateChapterInputSchema,
} from "@ebook/shared";
import { Router } from "express";
import { idParam } from "../../lib/params";
import { currentUserId } from "../../middleware/require-auth";
import { queueMemoryUpdate as queueUpdate, type MemoryQueue } from "../memory/memory-queue";
import * as chaptersService from "./chapters.service";

/** Mounted at /books, behind requireAuth. New chapter text is queued for Story Memory. */
export function createChaptersRouter(memoryQueue: MemoryQueue) {
  const chaptersRouter = Router();

  const queueMemoryUpdate = (chapterId: string) => queueUpdate(memoryQueue, chapterId);

  chaptersRouter.post("/:bookId/chapters", async (req, res) => {
    const bookId = idParam(req.params.bookId, "Book");
    const input = createChapterInputSchema.parse(req.body);
    const chapter = await chaptersService.createChapter(currentUserId(req), bookId, input);
    if (input.content) await queueMemoryUpdate(chapter.id);
    res.status(201).json(chapter);
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
    const chapter = await chaptersService.updateChapter(
      currentUserId(req),
      bookId,
      chapterId,
      input,
    );
    if (input.content !== undefined) await queueMemoryUpdate(chapterId);
    res.json(chapter);
  });

  chaptersRouter.delete("/:bookId/chapters/:chapterId", async (req, res) => {
    const bookId = idParam(req.params.bookId, "Book");
    const chapterId = idParam(req.params.chapterId, "Chapter");
    await chaptersService.deleteChapter(currentUserId(req), bookId, chapterId);
    res.status(204).end();
  });

  return chaptersRouter;
}
