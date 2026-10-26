import { prisma } from "../../lib/db";
import type { LlmProvider } from "../../lib/llm";
import { logger } from "../../lib/logger";
import { recordUsage } from "../ai/ai-usage";
import { consistencyPrompt, verdictsSchema, type FactPair } from "./memory-prompts";
import { attributesRelated, normalizeValue } from "./names";

/** Upper bound on pairs sent to the model in one check */
const MAX_PAIRS = 30;

/** Identifies a conflict independently of fact ids, which change when chapters are re-read. */
export function conflictFingerprint(
  entityId: string,
  first: { attribute: string; value: string },
  second: { attribute: string; value: string },
): string {
  const [a, b] = [first, second]
    .map((fact) => `${fact.attribute}=${normalizeValue(fact.value)}`)
    .sort();
  return `${entityId}|${a}|${b}`;
}

const where = (fact: { chapter: { position: number; title: string } | null }) =>
  fact.chapter
    ? `chapter ${fact.chapter.position + 1}, "${fact.chapter.title}"`
    : "set by the author";

/**
 * Compares the facts just extracted from a chapter with what the rest of the
 * book says. Cheap checks find candidate pairs: the same entity, related
 * detail labels ("injury" / "injured hand"), and different values. The model
 * then rules out pairs that only differ in wording or describe a natural
 * change. Real contradictions become warnings.
 */
export async function checkChapterConsistency(
  llm: LlmProvider,
  bookId: string,
  chapterId: string,
  ownerId: string,
): Promise<number> {
  const include = { entity: true, chapter: { select: { position: true, title: true } } } as const;
  const newFacts = await prisma.fact.findMany({ where: { chapterId }, include });
  if (newFacts.length === 0) return 0;

  const existing = await prisma.fact.findMany({
    where: {
      entityId: { in: [...new Set(newFacts.map((fact) => fact.entityId))] },
      OR: [{ chapterId: { not: chapterId } }, { chapterId: null }],
    },
    include,
  });
  // Skip conflicts the author dismissed, and ones already reported: two chapters
  // stating the same detail would otherwise raise the same conflict twice
  const known = new Set([
    ...(await prisma.dismissedConflict.findMany({ where: { bookId } })).map((d) => d.fingerprint),
    ...(
      await prisma.consistencyWarning.findMany({
        where: { bookId, status: "open" },
        select: { fingerprint: true },
      })
    ).map((w) => w.fingerprint),
  ]);

  const candidates = newFacts
    .flatMap((fact) =>
      existing
        .filter(
          (other) =>
            other.entityId === fact.entityId &&
            attributesRelated(other.attribute, fact.attribute) &&
            normalizeValue(other.value) !== normalizeValue(fact.value),
        )
        .map((other) => ({
          fact,
          other,
          fingerprint: conflictFingerprint(fact.entityId, fact, other),
        })),
    )
    .filter((candidate) => {
      if (known.has(candidate.fingerprint)) return false;
      known.add(candidate.fingerprint);
      return true;
    })
    // Exact label matches are the strongest candidates; check those first
    .sort(
      (a, b) =>
        Number(b.fact.attribute === b.other.attribute) -
        Number(a.fact.attribute === a.other.attribute),
    )
    .slice(0, MAX_PAIRS);

  if (candidates.length === 0) return 0;

  const pairs: FactPair[] = candidates.map(({ fact, other }) => ({
    entity: fact.entity.name,
    first: { attribute: other.attribute, value: other.value, where: where(other) },
    second: { attribute: fact.attribute, value: fact.value, where: where(fact) },
  }));

  const { text, usage } = await llm.generate(consistencyPrompt(pairs));
  await recordUsage(ownerId, "memory", usage);

  const parsed = verdictsSchema.safeParse(safeJson(text));
  if (!parsed.success) {
    logger.warn({ bookId, chapterId }, "Consistency check returned unreadable output");
    return 0;
  }

  const contradictions = parsed.data.verdicts.filter(
    (verdict) => verdict.contradiction && candidates[verdict.pair - 1],
  );
  const { count } = await prisma.consistencyWarning.createMany({
    data: contradictions.map((verdict) => {
      const candidate = candidates[verdict.pair - 1]!;
      return {
        bookId,
        factId: candidate.fact.id,
        conflictingFactId: candidate.other.id,
        explanation: verdict.explanation,
        fingerprint: candidate.fingerprint,
      };
    }),
    skipDuplicates: true,
  });
  return count;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
