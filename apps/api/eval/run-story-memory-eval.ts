/**
 * Measures how well Story Memory catches continuity errors, using the real model.
 *
 *   npm run eval:memory -w @ebook/api            (3 runs)
 *   EVAL_RUNS=1 npm run eval:memory -w @ebook/api
 *
 * Each run creates a throwaway user and book, reads every chapter through the
 * memory pipeline in order, compares the warnings with the planted
 * contradictions, and deletes everything it created. Model output varies, so
 * results are reported across several runs. Uses real API tokens.
 */
import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/db";
import { env } from "../src/lib/env";
import { GeminiProvider } from "../src/lib/llm/gemini";
import { processChapterMemory } from "../src/modules/memory/pipeline";
import {
  BOOK,
  CHAPTERS,
  NOT_CONTRADICTIONS,
  PLANTED,
  type PlantedContradiction,
} from "./story-fixture";

if (!env.GEMINI_API_KEY) {
  console.error("Set GEMINI_API_KEY in apps/api/.env to run the evaluation.");
  process.exit(1);
}

const llm = new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL, {
  embeddingModel: env.GEMINI_EMBEDDING_MODEL,
  memoryModel: env.GEMINI_MEMORY_MODEL,
});

const RUNS = Number(process.env.EVAL_RUNS ?? 3);

interface Warning {
  entityName: string;
  attribute: string;
  values: [string, string];
  explanation: string;
}

/**
 * In the app, the job queue retries a chapter when the model is overloaded.
 * This script calls the pipeline directly, so it retries the same way.
 */
async function processWithRetries(chapterId: string) {
  const waits = [15_000, 30_000, 60_000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await processChapterMemory(llm, chapterId);
    } catch (error) {
      const wait = waits[attempt];
      if (wait === undefined || (error as { code?: string }).code !== "AI_BUSY") throw error;
      console.log(`  Model busy; retrying in ${wait / 1000} s`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

const includesAny = (text: string, words: string[]) =>
  words.some((word) => new RegExp(`\\b${word}\\b`, "i").test(text));

function matches(planted: PlantedContradiction, warning: Warning): boolean {
  if (!warning.entityName.toLowerCase().includes(planted.entity)) return false;
  const [a, b] = warning.values;
  const [first, second] = planted.values;
  return (
    (includesAny(a, first) && includesAny(b, second)) ||
    (includesAny(a, second) && includesAny(b, first))
  );
}

/** One full pass over the story in a throwaway book. */
async function runOnce() {
  const user = await prisma.user.create({
    data: { email: `eval-${Date.now()}@example.invalid`, name: "Eval", passwordHash: "-" },
  });
  try {
    const book = await prisma.book.create({
      data: {
        ownerId: user.id,
        title: BOOK.title,
        author: "Eval",
        genre: BOOK.genre,
        premise: BOOK.premise,
      },
    });

    const started = Date.now();
    for (const [position, chapter] of CHAPTERS.entries()) {
      const created = await prisma.chapter.create({
        data: { bookId: book.id, position, title: chapter.title, content: chapter.content },
      });
      await processWithRetries(created.id);
    }
    const seconds = (Date.now() - started) / 1000;

    const warnings: Warning[] = (
      await prisma.consistencyWarning.findMany({
        where: { bookId: book.id },
        include: { fact: { include: { entity: true } }, conflictingFact: true },
      })
    ).map((warning) => ({
      entityName: warning.fact.entity.name,
      attribute: warning.fact.attribute,
      values: [warning.conflictingFact.value, warning.fact.value],
      explanation: warning.explanation,
    }));
    const usage = await prisma.aiUsage.aggregate({
      where: { userId: user.id },
      _sum: { inputTokens: true, outputTokens: true },
    });

    return {
      seconds,
      tokens: (usage._sum.inputTokens ?? 0) + (usage._sum.outputTokens ?? 0),
      caught: PLANTED.map((planted) => warnings.find((warning) => matches(planted, warning))),
      falseAlarms: warnings.filter((warning) => !PLANTED.some((p) => matches(p, warning))),
    };
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
}

const runs: Awaited<ReturnType<typeof runOnce>>[] = [];
try {
  for (let run = 1; run <= RUNS; run++) {
    const result = await runOnce();
    console.log(
      `Run ${run}: caught ${result.caught.filter(Boolean).length}/${PLANTED.length}, ` +
        `${result.falseAlarms.length} false alarms, ${result.seconds.toFixed(0)} s`,
    );
    runs.push(result);
  }
} finally {
  await prisma.$disconnect();
}

const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const totalCaught = runs.reduce((sum, run) => sum + run.caught.filter(Boolean).length, 0);
const totalFalseAlarms = runs.reduce((sum, run) => sum + run.falseAlarms.length, 0);
const possible = RUNS * PLANTED.length;
const describe = (w: Warning) =>
  `${w.entityName}, ${w.attribute}: "${w.values[0]}" vs "${w.values[1]}"`;

const lines = [
  "# Story Memory evaluation",
  "",
  `An 8-chapter story with ${PLANTED.length} planted continuity errors and ` +
    `${NOT_CONTRADICTIONS.length} changes the story explains, read chapter by chapter by the ` +
    "real pipeline. Source: [`apps/api/eval`](../../apps/api/eval). " +
    "Run it with `npm run eval:memory -w @ebook/api`.",
  "",
  `Model: \`${env.GEMINI_MEMORY_MODEL}\` · ${new Date().toISOString().slice(0, 10)} · ` +
    `${RUNS} runs · about ${average(runs.map((r) => r.seconds)).toFixed(0)} s and ` +
    `${Math.round(average(runs.map((r) => r.tokens))).toLocaleString("en")} tokens per run`,
  "",
  `**Caught ${((totalCaught / possible) * 100).toFixed(0)}% of planted contradictions ` +
    `(${totalCaught} of ${possible} across ${RUNS} runs), with ${totalFalseAlarms} false ` +
    `alarm${totalFalseAlarms === 1 ? "" : "s"} in total.**`,
  "",
  "| Planted contradiction | Caught | Example warning |",
  "|---|---|---|",
  ...PLANTED.map((planted, i) => {
    const hits = runs.map((run) => run.caught[i]).filter((w): w is Warning => Boolean(w));
    return `| ${planted.description} | ${hits.length}/${RUNS} | ${hits[0] ? describe(hits[0]) : ""} |`;
  }),
  "",
  "## Changes the story explains (should not be flagged)",
  "",
  ...NOT_CONTRADICTIONS.map((item) => `- ${item}`),
  "",
  "## False alarms",
  "",
  ...(totalFalseAlarms
    ? runs.flatMap((run, i) =>
        run.falseAlarms.map((w) => `- Run ${i + 1}: ${describe(w)}. ${w.explanation}`),
      )
    : ["None."]),
  "",
];

const report = lines.join("\n");
console.log(`\n${report}`);
writeFileSync(new URL("../../../docs/eval/story-memory.md", import.meta.url), report);
