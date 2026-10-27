import {
  createBranchInputSchema,
  createVersionInputSchema,
  listVersionsQuerySchema,
  updateBranchInputSchema,
} from "@ebook/shared";
import { Router, type Request } from "express";
import { idParam } from "../../lib/params";
import { currentUserId } from "../../middleware/require-auth";
import { queueMemoryUpdate, type MemoryQueue } from "../memory/memory-queue";
import * as versionsService from "./versions.service";

const BASE = "/:bookId/chapters/:chapterId";

function chapterParams(req: Request) {
  return {
    userId: currentUserId(req),
    bookId: idParam(req.params.bookId, "Book"),
    chapterId: idParam(req.params.chapterId, "Chapter"),
  };
}

/**
 * Version history and what-if branches. Mounted at /books, behind requireAuth.
 * Only changes to the main text are sent to Story Memory; branches are drafts.
 */
export function createVersionsRouter(memoryQueue: MemoryQueue) {
  const router = Router();

  router.get(`${BASE}/versions`, async (req, res) => {
    const { userId, bookId, chapterId } = chapterParams(req);
    const { branchId } = listVersionsQuerySchema.parse(req.query);
    res.json(await versionsService.listVersions(userId, bookId, chapterId, branchId));
  });

  router.post(`${BASE}/versions`, async (req, res) => {
    const { userId, bookId, chapterId } = chapterParams(req);
    // Every field is optional, so a request with no body at all is fine
    const input = createVersionInputSchema.parse(req.body ?? {});
    const { version, created } = await versionsService.createVersion(
      userId,
      bookId,
      chapterId,
      input,
    );
    res.status(created ? 201 : 200).json(version);
  });

  router.get(`${BASE}/versions/:versionId`, async (req, res) => {
    const { userId, bookId, chapterId } = chapterParams(req);
    const versionId = idParam(req.params.versionId, "Version");
    res.json(await versionsService.getVersion(userId, bookId, chapterId, versionId));
  });

  router.post(`${BASE}/versions/:versionId/restore`, async (req, res) => {
    const { userId, bookId, chapterId } = chapterParams(req);
    const versionId = idParam(req.params.versionId, "Version");
    const result = await versionsService.restoreVersion(userId, bookId, chapterId, versionId);
    if (result.target === "main") await queueMemoryUpdate(memoryQueue, chapterId);
    res.json(result);
  });

  router.get(`${BASE}/branches`, async (req, res) => {
    const { userId, bookId, chapterId } = chapterParams(req);
    res.json(await versionsService.listBranches(userId, bookId, chapterId));
  });

  router.post(`${BASE}/branches`, async (req, res) => {
    const { userId, bookId, chapterId } = chapterParams(req);
    const input = createBranchInputSchema.parse(req.body);
    res.status(201).json(await versionsService.createBranch(userId, bookId, chapterId, input));
  });

  router.get(`${BASE}/branches/:branchId`, async (req, res) => {
    const { userId, bookId, chapterId } = chapterParams(req);
    const branchId = idParam(req.params.branchId, "Branch");
    res.json(await versionsService.getBranch(userId, bookId, chapterId, branchId));
  });

  router.patch(`${BASE}/branches/:branchId`, async (req, res) => {
    const { userId, bookId, chapterId } = chapterParams(req);
    const branchId = idParam(req.params.branchId, "Branch");
    const input = updateBranchInputSchema.parse(req.body);
    res.json(await versionsService.updateBranch(userId, bookId, chapterId, branchId, input));
  });

  router.post(`${BASE}/branches/:branchId/keep`, async (req, res) => {
    const { userId, bookId, chapterId } = chapterParams(req);
    const branchId = idParam(req.params.branchId, "Branch");
    const chapter = await versionsService.keepBranch(userId, bookId, chapterId, branchId);
    await queueMemoryUpdate(memoryQueue, chapterId);
    res.json(chapter);
  });

  router.delete(`${BASE}/branches/:branchId`, async (req, res) => {
    const { userId, bookId, chapterId } = chapterParams(req);
    const branchId = idParam(req.params.branchId, "Branch");
    await versionsService.deleteBranch(userId, bookId, chapterId, branchId);
    res.status(204).end();
  });

  return router;
}
