import {
  createEntityInputSchema,
  createFactInputSchema,
  updateEntityInputSchema,
} from "@ebook/shared";
import { Router } from "express";
import { logger } from "../../lib/logger";
import { idParam } from "../../lib/params";
import { currentUserId } from "../../middleware/require-auth";
import type { MemoryQueue } from "./memory-queue";
import * as storyBible from "./story-bible.service";

/** Mounted at /books, behind requireAuth */
export function createStoryBibleRouter(memoryQueue: MemoryQueue, memoryEnabled: boolean) {
  const router = Router();

  router.get("/:bookId/story-bible", async (req, res) => {
    const bookId = idParam(req.params.bookId, "Book");
    // Re-queueing is cheap: the queue debounces per chapter, so duplicates collapse
    const queuePending = async (chapterIds: string[]) => {
      await Promise.all(chapterIds.map((id) => memoryQueue.enqueueChapter(id))).catch(
        (error: unknown) => logger.error({ err: error, bookId }, "Couldn't queue unread chapters"),
      );
    };
    res.json(
      await storyBible.getStoryBible(currentUserId(req), bookId, memoryEnabled, queuePending),
    );
  });

  router.post("/:bookId/memory/refresh", async (req, res) => {
    const bookId = idParam(req.params.bookId, "Book");
    const chapterIds = await storyBible.chaptersToRefresh(currentUserId(req), bookId);
    await Promise.all(chapterIds.map((id) => memoryQueue.enqueueChapter(id, { force: true })));
    res.status(202).json({ queued: chapterIds.length });
  });

  router.post("/:bookId/entities", async (req, res) => {
    const bookId = idParam(req.params.bookId, "Book");
    const input = createEntityInputSchema.parse(req.body);
    res.status(201).json(await storyBible.createEntity(currentUserId(req), bookId, input));
  });

  router.patch("/:bookId/entities/:entityId", async (req, res) => {
    const bookId = idParam(req.params.bookId, "Book");
    const entityId = idParam(req.params.entityId, "Story Bible entry");
    const input = updateEntityInputSchema.parse(req.body);
    res.json(await storyBible.updateEntity(currentUserId(req), bookId, entityId, input));
  });

  router.delete("/:bookId/entities/:entityId", async (req, res) => {
    const bookId = idParam(req.params.bookId, "Book");
    const entityId = idParam(req.params.entityId, "Story Bible entry");
    await storyBible.deleteEntity(currentUserId(req), bookId, entityId);
    res.status(204).end();
  });

  router.post("/:bookId/entities/:entityId/facts", async (req, res) => {
    const bookId = idParam(req.params.bookId, "Book");
    const entityId = idParam(req.params.entityId, "Story Bible entry");
    const input = createFactInputSchema.parse(req.body);
    res.status(201).json(await storyBible.addFact(currentUserId(req), bookId, entityId, input));
  });

  router.delete("/:bookId/entities/:entityId/facts/:factId", async (req, res) => {
    const bookId = idParam(req.params.bookId, "Book");
    const entityId = idParam(req.params.entityId, "Story Bible entry");
    const factId = idParam(req.params.factId, "Detail");
    res.json(await storyBible.deleteFact(currentUserId(req), bookId, entityId, factId));
  });

  router.post("/:bookId/warnings/:warningId/dismiss", async (req, res) => {
    const bookId = idParam(req.params.bookId, "Book");
    const warningId = idParam(req.params.warningId, "Warning");
    await storyBible.dismissWarning(currentUserId(req), bookId, warningId);
    res.status(204).end();
  });

  return router;
}
