import { createHash } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { AppError } from "../../lib/errors";
import type { LlmProvider } from "../../lib/llm";
import { recordUsage } from "../ai/ai-usage";
import { chunkText } from "./chunker";
import { checkChapterConsistency } from "./consistency";
import {
  extractionPrompt,
  extractionSchema,
  type Extraction,
  type KnownEntity,
} from "./memory-prompts";
import { findMatchingEntity, isPronoun, normalizeAttribute, normalizeName } from "./names";

export type MemoryResult = "processed" | "unchanged" | "missing";

export const contentHash = (content: string) => createHash("sha256").update(content).digest("hex");

const IGNORED_ATTRIBUTES = new Set(["type", "kind", "category", "name"]);

/** pgvector's text format, e.g. "[0.1,0.2,…]" */
const toVectorLiteral = (vector: number[]) => `[${vector.join(",")}]`;

/**
 * Brings Story Memory up to date for one chapter:
 *   1. split the text into passages and store their embeddings (for retrieval)
 *   2. extract a summary, entities, and facts with one structured model call
 *   3. merge entities into the Story Bible, replacing this chapter's old facts
 *   4. check the new facts against the rest of the book for contradictions
 *
 * Runs in a background job after edits. If the text hasn't changed since the
 * last run it returns immediately, so repeated jobs are cheap. `force` re-reads
 * anyway, for when the author asks to rebuild the Story Bible.
 */
export async function processChapterMemory(
  llm: LlmProvider,
  chapterId: string,
  { force = false }: { force?: boolean } = {},
): Promise<MemoryResult> {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    include: {
      book: { select: { id: true, ownerId: true, title: true, genre: true, premise: true } },
    },
  });
  if (!chapter) return "missing";

  const hash = contentHash(chapter.content);
  if (!force && chapter.memoryHash === hash) return "unchanged";

  const { book } = chapter;

  if (!chapter.content.trim()) {
    await prisma.$transaction(async (tx) => {
      await clearChapterMemory(tx, chapterId);
      await saveChapterState(tx, chapterId, "", hash);
      await deleteOrphanEntities(tx, book.id);
    });
    return "processed";
  }

  const chunks = chunkText(chapter.content);
  const vectors = await llm.embed(chunks, "document");

  const extraction = await extract(llm, book, chapter, await loadKnownEntities(book.id));

  await prisma.$transaction(async (tx) => {
    await clearChapterMemory(tx, chapterId);
    await tx.$executeRaw`
      INSERT INTO chunks (id, book_id, chapter_id, position, text, embedding)
      SELECT gen_random_uuid(), ${book.id}::uuid, ${chapterId}::uuid, t.ord - 1, t.text, t.vec::vector
      FROM unnest(${chunks}::text[], ${vectors.map(toVectorLiteral)}::text[])
        WITH ORDINALITY AS t(text, vec, ord)`;
    await mergeEntities(tx, book.id, chapterId, extraction);
    await saveChapterState(tx, chapterId, extraction.summary, hash);
    await deleteOrphanEntities(tx, book.id);
  });

  await checkChapterConsistency(llm, book.id, chapterId, book.ownerId);
  return "processed";
}

async function extract(
  llm: LlmProvider,
  book: { ownerId: string; title: string; genre: string; premise: string },
  chapter: { position: number; title: string; content: string },
  known: KnownEntity[],
): Promise<Extraction> {
  const request = extractionPrompt(book, chapter, known);
  // Structured output is reliable but not guaranteed, so allow one retry
  for (let attempt = 0; attempt < 2; attempt++) {
    const { text, usage } = await llm.generate(request);
    await recordUsage(book.ownerId, "memory", usage);
    try {
      const parsed = extractionSchema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
    } catch {
      // fall through to the retry
    }
  }
  throw new AppError(502, "AI_BAD_RESPONSE", "Story Memory couldn't read the model's output");
}

/** Entities the book already has, so the model reuses their names and detail labels. */
async function loadKnownEntities(bookId: string): Promise<KnownEntity[]> {
  const entities = await prisma.entity.findMany({
    where: { bookId },
    include: { facts: { select: { attribute: true }, distinct: ["attribute"] } },
    orderBy: { createdAt: "asc" },
    take: 150,
  });
  return entities.map((entity) => ({
    name: entity.name,
    kind: entity.kind,
    aliases: entity.aliases,
    attributes: entity.facts.map((fact) => fact.attribute),
  }));
}

/** Removes what an earlier run extracted from this chapter. Author-added facts stay. */
async function clearChapterMemory(tx: Prisma.TransactionClient, chapterId: string) {
  await tx.chunk.deleteMany({ where: { chapterId } });
  await tx.fact.deleteMany({ where: { chapterId, source: "ai" } });
  await tx.mention.deleteMany({ where: { chapterId } });
}

async function mergeEntities(
  tx: Prisma.TransactionClient,
  bookId: string,
  chapterId: string,
  extraction: Extraction,
) {
  const entities = await tx.entity.findMany({ where: { bookId } });

  for (const extracted of extraction.entities) {
    let entity = findMatchingEntity(entities, extracted);

    if (!entity) {
      entity = await tx.entity.create({
        data: {
          bookId,
          kind: extracted.kind,
          name: extracted.name,
          aliases: uniqueNames(extracted.aliases, extracted.name),
          description: extracted.description,
        },
      });
      entities.push(entity);
    } else {
      const aliases = uniqueNames(
        [...entity.aliases, extracted.name, ...extracted.aliases],
        entity.name,
      );
      // The author's wording is never replaced; AI descriptions are only filled in when empty
      const description =
        entity.source === "ai" && !entity.description ? extracted.description : entity.description;
      if (aliases.length !== entity.aliases.length || description !== entity.description) {
        entity = await tx.entity.update({
          where: { id: entity.id },
          data: { aliases, description },
        });
        entities[entities.findIndex((e) => e.id === entity!.id)] = entity;
      }
    }

    await tx.mention.upsert({
      where: { entityId_chapterId: { entityId: entity.id, chapterId } },
      create: { entityId: entity.id, chapterId, excerpt: extracted.excerpt },
      update: { excerpt: extracted.excerpt },
    });

    // The model sometimes repeats a detail; keep one fact per attribute and value
    const seen = new Set<string>();
    await tx.fact.createMany({
      data: extracted.facts
        .map((fact) => ({ attribute: normalizeAttribute(fact.attribute), value: fact.value }))
        .filter((fact) => {
          // "type: island" just restates the entity's kind; it adds noise, not consistency
          if (IGNORED_ATTRIBUTES.has(fact.attribute)) return false;
          const key = `${fact.attribute}|${normalizeName(fact.value)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((fact) => ({ ...fact, entityId: entity.id, chapterId })),
    });
  }
}

/** Distinct names other than the entity's own name, compared loosely. Pronouns are dropped. */
function uniqueNames(names: string[], ownName: string): string[] {
  const seen = new Set([normalizeName(ownName)]);
  return names.filter((name) => {
    const key = normalizeName(name);
    if (!key || seen.has(key) || isPronoun(name)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Raw SQL so this doesn't bump the chapter's updatedAt: that timestamp means
 * "the author edited this", and the dashboard sorts by it.
 */
async function saveChapterState(
  tx: Prisma.TransactionClient,
  chapterId: string,
  summary: string,
  hash: string,
) {
  await tx.$executeRaw`
    UPDATE chapters SET summary = ${summary}, memory_hash = ${hash} WHERE id = ${chapterId}::uuid`;
}

/** AI-created entities no chapter mentions any more (e.g. after a rewrite) are removed. */
async function deleteOrphanEntities(tx: Prisma.TransactionClient, bookId: string) {
  await tx.entity.deleteMany({
    where: { bookId, source: "ai", pinned: false, mentions: { none: {} }, facts: { none: {} } },
  });
}
