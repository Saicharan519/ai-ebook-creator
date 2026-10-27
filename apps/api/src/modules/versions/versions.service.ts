import {
  countWords,
  type Branch,
  type BranchSummary,
  type Chapter,
  type CreateBranchInput,
  type RestoreResult,
  type UpdateBranchInput,
  type Version,
  type VersionReason,
  type VersionSummary,
} from "@ebook/shared";
import {
  Prisma,
  type ChapterBranch as BranchRow,
  type ChapterVersion as VersionRow,
} from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { AppError, ConflictError, NotFoundError } from "../../lib/errors";
import { toChapterDto } from "../chapters/chapters.dto";
import { findOwnedChapter } from "../chapters/chapters.service";
import { snapshotIfDue, takeSnapshot, type Line } from "./snapshots";

const VERSIONS_LISTED = 100;
const BRANCHES_PER_CHAPTER = 10;

function toVersionSummaryDto(version: VersionRow): VersionSummary {
  return {
    id: version.id,
    branchId: version.branchId,
    reason: version.reason,
    label: version.label,
    title: version.title,
    wordCount: version.wordCount,
    createdAt: version.createdAt.toISOString(),
  };
}

function toVersionDto(version: VersionRow): Version {
  return { ...toVersionSummaryDto(version), content: version.content };
}

function toBranchSummaryDto(branch: BranchRow): BranchSummary {
  return {
    id: branch.id,
    name: branch.name,
    wordCount: branch.wordCount,
    createdAt: branch.createdAt.toISOString(),
    updatedAt: branch.updatedAt.toISOString(),
  };
}

function toBranchDto(branch: BranchRow): Branch {
  return { ...toBranchSummaryDto(branch), chapterId: branch.chapterId, content: branch.content };
}

const touchBook = (tx: Prisma.TransactionClient, bookId: string) =>
  tx.book.update({ where: { id: bookId }, data: { updatedAt: new Date() } });

async function findOwnedBranch(userId: string, bookId: string, chapterId: string, id: string) {
  await findOwnedChapter(userId, bookId, chapterId);
  const branch = await prisma.chapterBranch.findFirst({ where: { id, chapterId } });
  if (!branch) {
    throw new NotFoundError("Branch not found");
  }
  return branch;
}

async function findVersion(chapterId: string, id: string) {
  const version = await prisma.chapterVersion.findFirst({ where: { id, chapterId } });
  if (!version) {
    throw new NotFoundError("Version not found");
  }
  return version;
}

/** Resolves an optional branch id to the line it names, checking it belongs to the chapter */
async function resolveLine(
  userId: string,
  bookId: string,
  chapterId: string,
  branchId: string | undefined,
): Promise<{ line: Line; title: string; content: string }> {
  const chapter = await findOwnedChapter(userId, bookId, chapterId);
  if (!branchId) {
    return { line: { chapterId, branchId: null }, title: chapter.title, content: chapter.content };
  }
  const branch = await findOwnedBranch(userId, bookId, chapterId, branchId);
  return { line: { chapterId, branchId }, title: chapter.title, content: branch.content };
}

// ---- Versions ----

export async function listVersions(
  userId: string,
  bookId: string,
  chapterId: string,
  branchId?: string,
): Promise<VersionSummary[]> {
  const { line } = await resolveLine(userId, bookId, chapterId, branchId);
  const versions = await prisma.chapterVersion.findMany({
    where: line,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: VERSIONS_LISTED,
  });
  return versions.map(toVersionSummaryDto);
}

export async function getVersion(
  userId: string,
  bookId: string,
  chapterId: string,
  versionId: string,
): Promise<Version> {
  await findOwnedChapter(userId, bookId, chapterId);
  return toVersionDto(await findVersion(chapterId, versionId));
}

export async function createVersion(
  userId: string,
  bookId: string,
  chapterId: string,
  input: {
    reason: Extract<VersionReason, "manual" | "before_ai">;
    label?: string;
    branchId?: string;
  },
): Promise<{ version: Version; created: boolean }> {
  const { line, title, content } = await resolveLine(userId, bookId, chapterId, input.branchId);
  const { version, created } = await prisma.$transaction((tx) =>
    takeSnapshot(tx, line, { title, content }, input.reason, input.label),
  );
  return { version: toVersionDto(version), created };
}

/**
 * Puts an old version's text back into the line it came from. The current text
 * is saved first, so a restore can itself be undone.
 */
export async function restoreVersion(
  userId: string,
  bookId: string,
  chapterId: string,
  versionId: string,
): Promise<RestoreResult> {
  await findOwnedChapter(userId, bookId, chapterId);
  const version = await findVersion(chapterId, versionId);
  const { line, title, content } = await resolveLine(
    userId,
    bookId,
    chapterId,
    version.branchId ?? undefined,
  );

  return prisma.$transaction(async (tx) => {
    await takeSnapshot(tx, line, { title, content }, "before_restore");
    await touchBook(tx, bookId);
    const restored = { content: version.content, wordCount: version.wordCount };

    if (line.branchId) {
      const branch = await tx.chapterBranch.update({
        where: { id: line.branchId },
        data: restored,
      });
      return { target: "branch", branch: toBranchDto(branch) };
    }
    const chapter = await tx.chapter.update({
      where: { id: chapterId },
      data: { ...restored, title: version.title },
    });
    return { target: "main", chapter: toChapterDto(chapter) };
  });
}

// ---- Branches ----

export async function listBranches(
  userId: string,
  bookId: string,
  chapterId: string,
): Promise<BranchSummary[]> {
  await findOwnedChapter(userId, bookId, chapterId);
  const branches = await prisma.chapterBranch.findMany({
    where: { chapterId },
    orderBy: { createdAt: "asc" },
  });
  return branches.map(toBranchSummaryDto);
}

export async function getBranch(
  userId: string,
  bookId: string,
  chapterId: string,
  branchId: string,
): Promise<Branch> {
  return toBranchDto(await findOwnedBranch(userId, bookId, chapterId, branchId));
}

/** Postgres unique violation, raised when a branch name is already taken */
const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

export async function createBranch(
  userId: string,
  bookId: string,
  chapterId: string,
  input: CreateBranchInput,
): Promise<Branch> {
  const chapter = await findOwnedChapter(userId, bookId, chapterId);
  const content = input.fromVersionId
    ? (await findVersion(chapterId, input.fromVersionId)).content
    : chapter.content;

  if ((await prisma.chapterBranch.count({ where: { chapterId } })) >= BRANCHES_PER_CHAPTER) {
    throw new AppError(
      400,
      "TOO_MANY_BRANCHES",
      `A chapter can have up to ${BRANCHES_PER_CHAPTER} what-if branches. Keep or discard one first.`,
    );
  }

  try {
    const branch = await prisma.chapterBranch.create({
      data: { chapterId, name: input.name, content, wordCount: countWords(content) },
    });
    return toBranchDto(branch);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("This chapter already has a branch with that name");
    }
    throw error;
  }
}

export async function updateBranch(
  userId: string,
  bookId: string,
  chapterId: string,
  branchId: string,
  input: UpdateBranchInput,
): Promise<Branch> {
  const previous = await findOwnedBranch(userId, bookId, chapterId, branchId);
  const chapter = await findOwnedChapter(userId, bookId, chapterId);

  try {
    const branch = await prisma.$transaction(async (tx) => {
      if (input.content !== undefined && input.content !== previous.content) {
        await snapshotIfDue(
          tx,
          { chapterId, branchId },
          { title: chapter.title, content: previous.content },
        );
      }
      await touchBook(tx, bookId);
      return tx.chapterBranch.update({
        where: { id: branchId },
        data: {
          ...input,
          ...(input.content !== undefined && { wordCount: countWords(input.content) }),
        },
      });
    });
    return toBranchDto(branch);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("This chapter already has a branch with that name");
    }
    throw error;
  }
}

/**
 * Makes the branch the chapter's main text. The old main text is saved as a
 * version, and the branch's own history moves over to the main line.
 */
export async function keepBranch(
  userId: string,
  bookId: string,
  chapterId: string,
  branchId: string,
): Promise<Chapter> {
  const branch = await findOwnedBranch(userId, bookId, chapterId, branchId);
  const chapter = await findOwnedChapter(userId, bookId, chapterId);

  const updated = await prisma.$transaction(async (tx) => {
    await takeSnapshot(
      tx,
      { chapterId, branchId: null },
      chapter,
      "before_keep",
      `Before keeping "${branch.name}"`,
    );
    await tx.chapterVersion.updateMany({ where: { branchId }, data: { branchId: null } });
    await tx.chapterBranch.delete({ where: { id: branchId } });
    await touchBook(tx, bookId);
    return tx.chapter.update({
      where: { id: chapterId },
      data: { content: branch.content, wordCount: branch.wordCount },
    });
  });
  return toChapterDto(updated);
}

export async function deleteBranch(
  userId: string,
  bookId: string,
  chapterId: string,
  branchId: string,
): Promise<void> {
  await findOwnedBranch(userId, bookId, chapterId, branchId);
  await prisma.chapterBranch.delete({ where: { id: branchId } });
}
