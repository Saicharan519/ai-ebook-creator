import { countWords } from "@ebook/shared";
import type { Prisma, VersionReason } from "../../generated/prisma/client";

/** A chapter's main text (branchId null) or one of its what-if branches */
export interface Line {
  chapterId: string;
  branchId: string | null;
}

interface TextState {
  title: string;
  content: string;
}

export const AUTOSAVE_INTERVAL_MS = 10 * 60 * 1000;
/** Older autosave snapshots are pruned; snapshots the author or an action asked for are kept */
export const AUTOSAVES_KEPT = 50;

function latestVersion(tx: Prisma.TransactionClient, line: Line) {
  return tx.chapterVersion.findFirst({
    where: line,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

/**
 * Saves a copy of `state`. Returns the latest version instead when it already
 * holds the same text, so repeated clicks don't fill the history with duplicates.
 */
export async function takeSnapshot(
  tx: Prisma.TransactionClient,
  line: Line,
  state: TextState,
  reason: VersionReason,
  label = "",
) {
  const latest = await latestVersion(tx, line);
  if (latest && latest.content === state.content && latest.title === state.title) {
    return { version: latest, created: false };
  }
  const version = await tx.chapterVersion.create({
    data: {
      ...line,
      reason,
      label,
      title: state.title,
      content: state.content,
      wordCount: countWords(state.content),
    },
  });
  return { version, created: true };
}

/**
 * Called on every autosave with the text as it was *before* the save, so the
 * history keeps what the author had, even if this save deleted most of it. At
 * most one autosave snapshot per line every 10 minutes.
 */
export async function snapshotIfDue(
  tx: Prisma.TransactionClient,
  line: Line,
  previous: TextState,
  now = new Date(),
) {
  if (previous.content.trim() === "") return;

  const latest = await latestVersion(tx, line);
  if (latest && now.getTime() - latest.createdAt.getTime() < AUTOSAVE_INTERVAL_MS) return;

  const { created } = await takeSnapshot(tx, line, previous, "autosave");
  if (!created) return;

  const stale = await tx.chapterVersion.findMany({
    where: { ...line, reason: "autosave" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: AUTOSAVES_KEPT,
    select: { id: true },
  });
  if (stale.length > 0) {
    await tx.chapterVersion.deleteMany({ where: { id: { in: stale.map(({ id }) => id) } } });
  }
}
