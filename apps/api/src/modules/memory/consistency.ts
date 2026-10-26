import { prisma } from "../../lib/db";
import type { LlmProvider } from "../../lib/llm";
import { logger } from "../../lib/logger";
import { recordUsage } from "../ai/ai-usage";
import { consistencyPrompt, verdictsSchema, type FactPair } from "./memory-prompts";
import { normalizeValue } from "./names";

/** Upper bound on pairs sent to the model in one check */
const MAX_PAIRS = 30;

/** Identifies a conflict independently of fact ids, which change when chapters are re-read. */
export function conflictFingerprint(
  entityId: string,
  attribute: string,
  values: [string, string],
): string {
  const [a, b] = values.map(normalizeValue).sort();
  return `${entityId}|${attribute}|${a}|${b}`;
}

const where = (fact: { chapter: { position: number; title: string } | null }) =>
  fact.chapter
    ? `chapter ${fact.chapter.position + 1}, "${fact.chapter.title}"`
    : "set by the author";

/**
 * Compares the facts just extracted from a chapter with what the rest of the
 * book says. Cheap string checks find candidate pairs (same entity, same
 * detail, different value); the model then rules out pairs that only differ
 * in wording or describe a natural change. Real contradictions become warnings.
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
  const dismissed = new Set(
    (await prisma.dismissedConflict.findMany({ where: { bookId } })).map((d) => d.fingerprint),
  );

  const candidates = newFacts
    .flatMap((fact) =>
      existing
        .filter(
          (other) =>
            other.entityId === fact.entityId &&
            other.attribute === fact.attribute &&
            normalizeValue(other.value) !== normalizeValue(fact.value),
        )
        .map((other) => ({
          fact,
          other,
          fingerprint: conflictFingerprint(fact.entityId, fact.attribute, [
            fact.value,
            other.value,
          ]),
        })),
    )
    .filter((candidate) => !dismissed.has(candidate.fingerprint))
    .slice(0, MAX_PAIRS);

  if (candidates.length === 0) return 0;

  const pairs: FactPair[] = candidates.map(({ fact, other }) => ({
    entity: fact.entity.name,
    attribute: fact.attribute,
    first: { value: other.value, where: where(other) },
    second: { value: fact.value, where: where(fact) },
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
