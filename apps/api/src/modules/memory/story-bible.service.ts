import type {
  ConsistencyWarning,
  CreateEntityInput,
  CreateFactInput,
  StoryBible,
  StoryEntity,
  UpdateEntityInput,
} from "@ebook/shared";
import { prisma } from "../../lib/db";
import { NotFoundError } from "../../lib/errors";
import { findOwnedBook } from "../books/books.service";
import { normalizeAttribute, normalizeName } from "./names";
import { contentHash } from "./pipeline";

const chapterRef = { select: { id: true, position: true, title: true } } as const;

const entityInclude = {
  facts: { include: { chapter: chapterRef }, orderBy: { createdAt: "asc" } },
  mentions: { include: { chapter: chapterRef } },
} as const;

type EntityRow = Awaited<ReturnType<typeof loadEntity>>;

function loadEntity(entityId: string) {
  return prisma.entity.findUniqueOrThrow({ where: { id: entityId }, include: entityInclude });
}

function toEntityDto(entity: EntityRow): StoryEntity {
  return {
    id: entity.id,
    kind: entity.kind,
    name: entity.name,
    aliases: entity.aliases,
    description: entity.description,
    pinned: entity.pinned,
    source: entity.source,
    facts: entity.facts.map((fact) => ({
      id: fact.id,
      attribute: fact.attribute,
      value: fact.value,
      source: fact.source,
      chapter: fact.chapter,
    })),
    appearances: entity.mentions
      .map((mention) => ({ ...mention.chapter, excerpt: mention.excerpt }))
      .sort((a, b) => a.position - b.position),
  };
}

async function findOwnedEntity(userId: string, bookId: string, entityId: string) {
  const entity = await prisma.entity.findFirst({
    where: { id: entityId, bookId, book: { ownerId: userId } },
  });
  if (!entity) {
    throw new NotFoundError("Story Bible entry not found");
  }
  return entity;
}

/** Chapters whose current text Story Memory hasn't read yet. */
async function findPendingChapters(bookId: string): Promise<string[]> {
  const chapters = await prisma.chapter.findMany({
    where: { bookId },
    select: { id: true, content: true, memoryHash: true },
  });
  return chapters
    .filter(
      (chapter) => chapter.content.trim() && chapter.memoryHash !== contentHash(chapter.content),
    )
    .map((chapter) => chapter.id);
}

/**
 * The book's Story Bible. Any chapter that hasn't been read yet is passed to
 * `queuePending`: that covers text saved before Story Memory existed, or while
 * the worker was down, so the "Reading…" status always resolves.
 */
export async function getStoryBible(
  userId: string,
  bookId: string,
  memoryEnabled: boolean,
  queuePending: (chapterIds: string[]) => Promise<void>,
): Promise<StoryBible> {
  await findOwnedBook(userId, bookId);

  const [entities, warnings, pendingChapters] = await Promise.all([
    prisma.entity.findMany({ where: { bookId }, include: entityInclude, orderBy: { name: "asc" } }),
    prisma.consistencyWarning.findMany({
      where: { bookId, status: "open" },
      include: {
        fact: { include: { chapter: chapterRef, entity: { select: { id: true, name: true } } } },
        conflictingFact: { include: { chapter: chapterRef } },
      },
      orderBy: { createdAt: "desc" },
    }),
    findPendingChapters(bookId),
  ]);
  if (memoryEnabled && pendingChapters.length) {
    await queuePending(pendingChapters);
  }

  return {
    entities: entities.map(toEntityDto),
    warnings: warnings.map((warning): ConsistencyWarning => ({
      id: warning.id,
      entityId: warning.fact.entity.id,
      entityName: warning.fact.entity.name,
      attribute: warning.fact.attribute,
      explanation: warning.explanation,
      fact: { value: warning.fact.value, chapter: warning.fact.chapter },
      conflictingFact: {
        value: warning.conflictingFact.value,
        chapter: warning.conflictingFact.chapter,
      },
    })),
    status: { enabled: memoryEnabled, pendingChapters: pendingChapters.length },
  };
}

export async function createEntity(
  userId: string,
  bookId: string,
  input: CreateEntityInput,
): Promise<StoryEntity> {
  await findOwnedBook(userId, bookId);
  const entity = await prisma.entity.create({
    data: {
      bookId,
      kind: input.kind,
      name: input.name,
      description: input.description ?? "",
      source: "author",
      pinned: true,
    },
  });
  return toEntityDto(await loadEntity(entity.id));
}

/**
 * Editing an entry makes it the author's: later extraction won't change its
 * wording. A renamed entry keeps its old name as an alias, so chapters that
 * use the old name still match it.
 */
export async function updateEntity(
  userId: string,
  bookId: string,
  entityId: string,
  input: UpdateEntityInput,
): Promise<StoryEntity> {
  const entity = await findOwnedEntity(userId, bookId, entityId);
  const renamed =
    input.name !== undefined && normalizeName(input.name) !== normalizeName(entity.name);
  const edited = renamed || input.description !== undefined;

  await prisma.entity.update({
    where: { id: entityId },
    data: {
      ...input,
      ...(renamed && {
        aliases: [entity.name, ...entity.aliases.filter((alias) => alias !== input.name)],
      }),
      ...(edited && { source: "author" }),
    },
  });
  return toEntityDto(await loadEntity(entityId));
}

export async function deleteEntity(userId: string, bookId: string, entityId: string) {
  await findOwnedEntity(userId, bookId, entityId);
  await prisma.entity.delete({ where: { id: entityId } });
}

export async function addFact(
  userId: string,
  bookId: string,
  entityId: string,
  input: CreateFactInput,
): Promise<StoryEntity> {
  await findOwnedEntity(userId, bookId, entityId);
  await prisma.fact.create({
    data: {
      entityId,
      attribute: normalizeAttribute(input.attribute),
      value: input.value,
      source: "author",
    },
  });
  return toEntityDto(await loadEntity(entityId));
}

export async function deleteFact(
  userId: string,
  bookId: string,
  entityId: string,
  factId: string,
): Promise<StoryEntity> {
  await findOwnedEntity(userId, bookId, entityId);
  const { count } = await prisma.fact.deleteMany({ where: { id: factId, entityId } });
  if (count === 0) {
    throw new NotFoundError("Detail not found");
  }
  return toEntityDto(await loadEntity(entityId));
}

/** The author says this difference is intended: hide it now and never raise it again. */
export async function dismissWarning(userId: string, bookId: string, warningId: string) {
  await findOwnedBook(userId, bookId);
  const warning = await prisma.consistencyWarning.findFirst({ where: { id: warningId, bookId } });
  if (!warning) {
    throw new NotFoundError("Warning not found");
  }
  await prisma.$transaction([
    prisma.dismissedConflict.upsert({
      where: { bookId_fingerprint: { bookId, fingerprint: warning.fingerprint } },
      create: { bookId, fingerprint: warning.fingerprint },
      update: {},
    }),
    prisma.consistencyWarning.update({ where: { id: warningId }, data: { status: "dismissed" } }),
  ]);
}

/** Chapters with text, for re-reading the whole book (e.g. after AI is first set up). */
export async function chaptersToRefresh(userId: string, bookId: string): Promise<string[]> {
  await findOwnedBook(userId, bookId);
  const chapters = await prisma.chapter.findMany({
    where: { bookId, NOT: { content: "" } },
    select: { id: true },
    orderBy: { position: "asc" },
  });
  return chapters.map((chapter) => chapter.id);
}
