import { prisma } from "../../lib/db";
import type { LlmProvider } from "../../lib/llm";
import { logger } from "../../lib/logger";
import { normalizeName } from "../memory/names";

/** Story Memory sections, ready to put in a prompt. Empty strings are left out. */
export interface MemoryContext {
  storyBible: string;
  earlierChapters: string;
  relatedPassages: string;
}

export const EMPTY_MEMORY: MemoryContext = {
  storyBible: "",
  earlierChapters: "",
  relatedPassages: "",
};

/** About 6k tokens of memory per request, on top of the task and the local text */
const DEFAULT_BUDGET_CHARS = 24_000;
const PASSAGES_TO_RETRIEVE = 6;
/** Cosine similarity below this is noise rather than a related passage */
const MIN_SIMILARITY = 0.3;

export interface MemoryItems {
  /** Already ordered by priority: pinned, then named in the focus text, then in this chapter */
  entities: string[];
  /** Earlier chapters, most recent first */
  summaries: { position: number; text: string }[];
  /** Most similar first */
  passages: string[];
}

/**
 * Fits memory into a character budget, filling sections in priority order:
 * Story Bible entries, then earlier-chapter summaries, then retrieved passages.
 * Whole items only; a section stops at the first item that doesn't fit.
 */
export function assembleMemoryContext(
  items: MemoryItems,
  budgetChars = DEFAULT_BUDGET_CHARS,
): MemoryContext {
  let remaining = budgetChars;
  const take = <T>(list: T[], size: (item: T) => number): T[] => {
    const taken: T[] = [];
    for (const item of list) {
      const cost = size(item) + 1;
      if (cost > remaining) break;
      remaining -= cost;
      taken.push(item);
    }
    return taken;
  };

  const entities = take(items.entities, (entity) => entity.length);
  const summaries = take(items.summaries, (summary) => summary.text.length)
    // Most recent were taken first; present them in reading order
    .sort((a, b) => a.position - b.position);
  const passages = take(items.passages, (passage) => passage.length);

  return {
    storyBible: entities.join("\n"),
    earlierChapters: summaries.map((summary) => summary.text).join("\n"),
    relatedPassages: passages.join("\n\n---\n\n"),
  };
}

interface EntityWithDetails {
  name: string;
  kind: string;
  aliases: string[];
  description: string;
  pinned: boolean;
  facts: { attribute: string; value: string; chapter: { position: number } | null }[];
}

/** One line per entity: "Elspeth Gunn (character; also Elspeth). Narrator. Details: eye colour: grey (ch. 1)" */
export function describeEntity(entity: EntityWithDetails): string {
  const seen = new Set<string>();
  const details = entity.facts
    .filter((fact) => {
      const key = `${fact.attribute}|${normalizeName(fact.value)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(
      (fact) =>
        `${fact.attribute}: ${fact.value}` +
        (fact.chapter ? ` (ch. ${fact.chapter.position + 1})` : " (author)"),
    );

  return [
    `${entity.name} (${entity.kind}${entity.aliases.length ? `; also ${entity.aliases.join(", ")}` : ""}).`,
    entity.description,
    details.length ? `Details: ${details.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** True if any of the entity's names appears in the text as a whole word. */
function isNamedIn(text: string, entity: { name: string; aliases: string[] }): boolean {
  const haystack = ` ${normalizeName(text)} `;
  return [entity.name, ...entity.aliases]
    .map(normalizeName)
    .some((name) => name.length > 1 && haystack.includes(` ${name} `));
}

export interface ContextRequest {
  bookId: string;
  chapterId: string;
  chapterPosition: number;
  /** The text the AI is working with; drives which entities and passages are relevant */
  focusText: string;
  budgetChars?: number;
}

/**
 * Loads Story Memory for an AI request. Memory makes suggestions better but
 * isn't essential, so failures are logged and the request continues with
 * whatever could be loaded: if only the embedding service is down, the Story
 * Bible and summaries are still used.
 */
export async function buildMemoryContext(
  llm: LlmProvider,
  request: ContextRequest,
): Promise<MemoryContext> {
  try {
    const [entities, summaries, passages] = await Promise.all([
      loadEntities(request),
      loadSummaries(request),
      retrievePassages(llm, request).catch((error: unknown) => {
        logger.warn({ err: error, bookId: request.bookId }, "Passage search unavailable");
        return [];
      }),
    ]);
    return assembleMemoryContext({ entities, summaries, passages }, request.budgetChars);
  } catch (error) {
    logger.warn(
      { err: error, bookId: request.bookId },
      "Story Memory unavailable for this request",
    );
    return EMPTY_MEMORY;
  }
}

async function loadEntities({ bookId, chapterId, focusText }: ContextRequest): Promise<string[]> {
  const entities = await prisma.entity.findMany({
    where: { bookId },
    include: {
      facts: {
        include: { chapter: { select: { position: true } } },
        orderBy: { createdAt: "asc" },
      },
      mentions: { where: { chapterId }, select: { chapterId: true } },
    },
  });

  const rank = (entity: (typeof entities)[number]) =>
    entity.pinned ? 0 : isNamedIn(focusText, entity) ? 1 : entity.mentions.length ? 2 : 3;

  return entities
    .filter((entity) => rank(entity) < 3)
    .sort((a, b) => rank(a) - rank(b))
    .map(describeEntity);
}

async function loadSummaries({ bookId, chapterPosition }: ContextRequest) {
  const chapters = await prisma.chapter.findMany({
    // Only chapters before this one: a draft must not know what happens later
    where: { bookId, position: { lt: chapterPosition }, NOT: { summary: "" } },
    orderBy: { position: "desc" },
    select: { position: true, title: true, summary: true },
  });
  return chapters.map((chapter) => ({
    position: chapter.position,
    text: `Chapter ${chapter.position + 1}, "${chapter.title}": ${chapter.summary}`,
  }));
}

async function retrievePassages(
  llm: LlmProvider,
  { bookId, chapterId, focusText }: ContextRequest,
): Promise<string[]> {
  if (!focusText.trim()) return [];
  const hasChunks = await prisma.chunk.count({
    where: { bookId, NOT: { chapterId } },
    take: 1,
  });
  if (!hasChunks) return [];

  const [query] = await llm.embed([focusText.slice(-2_000)], "query");
  const vector = `[${query!.join(",")}]`;

  // <=> is pgvector's cosine distance; similarity = 1 - distance
  const rows = await prisma.$queryRaw<{ text: string; position: number; similarity: number }[]>`
    SELECT c.text, ch.position, 1 - (c.embedding <=> ${vector}::vector) AS similarity
    FROM chunks c JOIN chapters ch ON ch.id = c.chapter_id
    WHERE c.book_id = ${bookId}::uuid AND c.chapter_id <> ${chapterId}::uuid
    ORDER BY c.embedding <=> ${vector}::vector
    LIMIT ${PASSAGES_TO_RETRIEVE}`;

  return rows
    .filter((row) => row.similarity >= MIN_SIMILARITY)
    .map((row) => `(From chapter ${row.position + 1})\n${row.text}`);
}
