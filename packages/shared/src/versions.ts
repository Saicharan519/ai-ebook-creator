import { z } from "zod";
import { CHAPTER_CONTENT_MAX, chapterSchema } from "./books";

export const versionReasonSchema = z.enum([
  "manual",
  "autosave",
  "before_ai",
  "before_restore",
  "before_keep",
]);

const branchName = z.string().trim().min(1, "Name is required").max(80);

// ---- Inputs ----

/** Only these can be asked for; the others are taken by the server itself */
export const createVersionInputSchema = z.object({
  reason: z.enum(["manual", "before_ai"]).default("manual"),
  label: z.string().trim().max(120).optional(),
  /** Snapshot this what-if branch instead of the main text */
  branchId: z.uuid().optional(),
});

export const listVersionsQuerySchema = z.object({
  branchId: z.uuid().optional(),
});

export const createBranchInputSchema = z.object({
  name: branchName,
  /** Start from this version's text instead of the current main text */
  fromVersionId: z.uuid().optional(),
});

export const updateBranchInputSchema = z.object({
  name: branchName.optional(),
  content: z.string().max(CHAPTER_CONTENT_MAX).optional(),
});

// ---- Responses ----

export const versionSummarySchema = z.object({
  id: z.uuid(),
  branchId: z.uuid().nullable(),
  reason: versionReasonSchema,
  label: z.string(),
  title: z.string(),
  wordCount: z.int().nonnegative(),
  createdAt: z.iso.datetime(),
});

export const versionSchema = versionSummarySchema.extend({ content: z.string() });

export const branchSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  wordCount: z.int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const branchSchema = branchSummarySchema.extend({
  chapterId: z.uuid(),
  content: z.string(),
});

/** What a restore changed: the main text (chapter) or a what-if branch */
export const restoreResultSchema = z.discriminatedUnion("target", [
  z.object({ target: z.literal("main"), chapter: chapterSchema }),
  z.object({ target: z.literal("branch"), branch: branchSchema }),
]);

export type VersionReason = z.infer<typeof versionReasonSchema>;
export type CreateVersionInput = z.input<typeof createVersionInputSchema>;
export type CreateBranchInput = z.infer<typeof createBranchInputSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchInputSchema>;
export type VersionSummary = z.infer<typeof versionSummarySchema>;
export type Version = z.infer<typeof versionSchema>;
export type BranchSummary = z.infer<typeof branchSummarySchema>;
export type Branch = z.infer<typeof branchSchema>;
export type RestoreResult = z.infer<typeof restoreResultSchema>;
