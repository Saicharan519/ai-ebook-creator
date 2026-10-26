import { bookSchema, type Book } from "@ebook/shared";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/db";
import { env } from "../src/lib/env";
import { FakeLlmProvider } from "../src/lib/llm";
import { chunkText } from "../src/modules/memory/chunker";
import { PgBossMemoryQueue, type MemoryQueue } from "../src/modules/memory/memory-queue";
import {
  attributesRelated,
  findMatchingEntity,
  isPronoun,
  normalizeName,
} from "../src/modules/memory/names";
import { processChapterMemory } from "../src/modules/memory/pipeline";
import { bearer, createUser, resetDatabase, type TestUser } from "./helpers";
import { entity, ScriptedMemoryModel } from "./scripted-model";

let llm: ScriptedMemoryModel;
let alice: TestUser;
let book: Book;

beforeEach(async () => {
  await resetDatabase();
  llm = new ScriptedMemoryModel();
  const app = createApp({ llm });
  alice = await createUser(app);
  const created = await request(app)
    .post("/books")
    .set(bearer(alice.accessToken))
    .send({ title: "The Lighthouse", author: "Alice" });
  book = bookSchema.parse(created.body);
});

async function addChapter(position: number, content: string) {
  if (position === 0) {
    const id = book.chapters[0]!.id;
    await prisma.chapter.update({ where: { id }, data: { content } });
    return id;
  }
  const chapter = await prisma.chapter.create({
    data: { bookId: book.id, position, title: `Chapter ${position + 1}`, content },
  });
  return chapter.id;
}

const entities = () =>
  prisma.entity.findMany({
    where: { bookId: book.id },
    include: { facts: true, mentions: true },
    orderBy: { name: "asc" },
  });

describe("chunkText", () => {
  it("groups short paragraphs and keeps them whole", () => {
    const paragraph = "word ".repeat(100).trim(); // 499 characters
    const chunks = chunkText([paragraph, paragraph, paragraph, paragraph].join("\n\n"));

    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.split("\n\n")).toHaveLength(2);
  });

  it("splits an oversized paragraph at sentence ends", () => {
    const sentence = "The lamp burned all night above the reef. ";
    const chunks = chunkText(sentence.repeat(120));

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 2_500)).toBe(true);
    expect(chunks.every((chunk) => chunk.trim().endsWith("reef."))).toBe(true);
  });

  it("returns nothing for blank text", () => {
    expect(chunkText("  \n\n ")).toEqual([]);
  });
});

describe("entity matching", () => {
  it("ignores case, accents, punctuation, and a leading 'the'", () => {
    expect(normalizeName("The Black Tooth!")).toBe("black tooth");
    expect(normalizeName("Éilis")).toBe("eilis");
  });

  it("matches an entity by any of its names", () => {
    const known = [
      { name: "Elspeth Gunn", aliases: ["Elspeth"] },
      { name: "Callum", aliases: [] },
    ];

    expect(findMatchingEntity(known, { name: "elspeth", aliases: [] })?.name).toBe("Elspeth Gunn");
    expect(findMatchingEntity(known, { name: "Old Callum", aliases: ["Callum"] })?.name).toBe(
      "Callum",
    );
    expect(findMatchingEntity(known, { name: "Morag", aliases: [] })).toBeUndefined();
  });

  it("treats differently worded labels for the same detail as related", () => {
    expect(attributesRelated("injury", "injured hand")).toBe(true);
    expect(attributesRelated("location", "located")).toBe(true);
    expect(attributesRelated("eye colour", "hair colour")).toBe(false);
    expect(attributesRelated("age", "occupation")).toBe(false);
  });

  it("never treats a pronoun as a name", () => {
    const known = [
      { name: "Dr Munro", aliases: [] },
      { name: "Callum", aliases: [] },
    ];
    expect(isPronoun("He")).toBe(true);
    expect(isPronoun("Hector")).toBe(false);
    // "He" must not tie two characters together
    expect(findMatchingEntity(known, { name: "Morag", aliases: ["he"] })).toBeUndefined();
  });

  it("matches a lone first or last name to a full name, only when it's unambiguous", () => {
    const one = [{ name: "Elspeth Gunn", aliases: [], kind: "character" }];
    const two = [
      { name: "John Gunn", aliases: [], kind: "character" },
      { name: "John Ross", aliases: [], kind: "character" },
    ];

    expect(findMatchingEntity(one, { name: "Miss Gunn", aliases: [] })?.name).toBe("Elspeth Gunn");
    expect(findMatchingEntity(one, { name: "Elspeth", aliases: [] })?.name).toBe("Elspeth Gunn");
    expect(findMatchingEntity(two, { name: "John", aliases: [] })).toBeUndefined();
    expect(
      findMatchingEntity(one, { name: "Elspeth", aliases: [], kind: "place" }),
    ).toBeUndefined();
  });
});

describe("processChapterMemory", () => {
  it("stores embedded passages, a summary, entities, mentions, and facts", async () => {
    const chapterId = await addChapter(0, "Elspeth climbed the tower.\n\nThe lamp was cold.");
    llm.script.set(1, {
      summary: "Elspeth returns to the lighthouse.",
      entities: [
        entity("Elspeth Gunn", [["eye colour", "grey"]], { aliases: ["Elspeth"] }),
        entity("Eilean Dubh", [], { kind: "place" }),
      ],
    });

    expect(await processChapterMemory(llm, chapterId)).toBe("processed");

    const [chunks] = await prisma.$queryRaw<{ count: bigint; dims: number }[]>`
      SELECT count(*) AS count, max(vector_dims(embedding)) AS dims FROM chunks
      WHERE chapter_id = ${chapterId}::uuid`;
    expect(Number(chunks!.count)).toBe(1);
    expect(chunks!.dims).toBe(768);

    const chapter = await prisma.chapter.findUniqueOrThrow({ where: { id: chapterId } });
    expect(chapter.summary).toBe("Elspeth returns to the lighthouse.");

    const stored = await entities();
    expect(stored.map((e) => [e.name, e.kind])).toEqual([
      ["Eilean Dubh", "place"],
      ["Elspeth Gunn", "character"],
    ]);
    expect(stored[1]!.facts.map((f) => [f.attribute, f.value])).toEqual([["eye colour", "grey"]]);
    expect(stored[1]!.mentions).toHaveLength(1);
  });

  it("skips chapters whose text hasn't changed since the last run", async () => {
    const chapterId = await addChapter(0, "Elspeth climbed the tower.");
    await processChapterMemory(llm, chapterId);
    const calls = llm.requests.length;

    expect(await processChapterMemory(llm, chapterId)).toBe("unchanged");
    expect(llm.requests).toHaveLength(calls);

    // ...unless the author asks to rebuild
    expect(await processChapterMemory(llm, chapterId, { force: true })).toBe("processed");
    expect(llm.requests.length).toBeGreaterThan(calls);
  });

  it("drops facts that only restate what kind of thing an entity is", async () => {
    const chapterId = await addChapter(0, "The island of Eilean Dubh.");
    llm.script.set(1, {
      summary: "",
      entities: [
        entity(
          "Eilean Dubh",
          [
            ["Type", "island"],
            ["location", "Scotland"],
          ],
          { kind: "place" },
        ),
      ],
    });

    await processChapterMemory(llm, chapterId);

    const [island] = await entities();
    expect(island!.facts.map((f) => f.attribute)).toEqual(["location"]);
  });

  it("merges the same character across chapters and tells the model what's known", async () => {
    const first = await addChapter(0, "Elspeth Gunn arrived.");
    const second = await addChapter(1, "Elspeth read the logbook.");
    llm.script.set(1, {
      summary: "",
      entities: [entity("Elspeth Gunn", [["eye colour", "grey"]])],
    });
    llm.script.set(2, {
      summary: "",
      entities: [entity("Elspeth", [], { aliases: ["Miss Gunn"] })],
    });

    await processChapterMemory(llm, first);
    await processChapterMemory(llm, second);

    const [elspeth] = await entities();
    expect(elspeth!.name).toBe("Elspeth Gunn");
    expect(elspeth!.aliases).toEqual(["Elspeth", "Miss Gunn"]);
    expect(elspeth!.mentions).toHaveLength(2);
    expect(llm.requests.at(-1)!.prompt).toContain(
      "- Elspeth Gunn (character); known details: eye colour",
    );
  });

  it("replaces a chapter's facts when it's re-read, but keeps the author's own entries", async () => {
    const chapterId = await addChapter(0, "Version one.");
    llm.script.set(1, { summary: "", entities: [entity("Callum", [["age", "60"]])] });
    await processChapterMemory(llm, chapterId);

    const callum = (await entities())[0]!;
    await prisma.entity.update({
      where: { id: callum.id },
      data: { description: "Written by the author.", source: "author" },
    });
    await prisma.fact.create({
      data: { entityId: callum.id, attribute: "boat", value: "the Kittiwake", source: "author" },
    });

    await prisma.chapter.update({ where: { id: chapterId }, data: { content: "Version two." } });
    llm.script.set(1, { summary: "", entities: [entity("Callum", [["age", "62"]])] });
    await processChapterMemory(llm, chapterId);

    const updated = (await entities())[0]!;
    expect(updated.description).toBe("Written by the author.");
    expect(updated.facts.map((f) => `${f.attribute}=${f.value}`).sort()).toEqual([
      "age=62",
      "boat=the Kittiwake",
    ]);
  });

  it("forgets what a chapter said when its text is deleted", async () => {
    const chapterId = await addChapter(0, "Morag waved from the pier.");
    llm.script.set(1, {
      summary: "Morag waves.",
      entities: [entity("Morag", [["hair colour", "red"]])],
    });
    await processChapterMemory(llm, chapterId);

    await prisma.chapter.update({ where: { id: chapterId }, data: { content: "" } });
    await processChapterMemory(llm, chapterId);

    expect(await entities()).toEqual([]);
    expect(await prisma.chunk.count()).toBe(0);
    const chapter = await prisma.chapter.findUniqueOrThrow({ where: { id: chapterId } });
    expect(chapter.summary).toBe("");
  });

  it("fails (so the job is retried) when the model's output can't be read twice", async () => {
    const chapterId = await addChapter(0, "Some text.");
    const broken = new FakeLlmProvider({ respond: () => "not json" });

    await expect(processChapterMemory(broken, chapterId)).rejects.toMatchObject({
      code: "AI_BAD_RESPONSE",
    });
  });
});

describe("consistency checking", () => {
  async function twoChaptersAbout(eyes: [string, string]) {
    const first = await addChapter(0, "Her eyes in chapter one.");
    const second = await addChapter(1, "Her eyes in chapter two.");
    llm.script.set(1, { summary: "", entities: [entity("Elspeth", [["eye colour", eyes[0]]])] });
    llm.script.set(2, { summary: "", entities: [entity("Elspeth", [["Eye Color", eyes[1]]])] });
    await processChapterMemory(llm, first);
    await processChapterMemory(llm, second);
    return { first, second };
  }

  const warnings = () =>
    prisma.consistencyWarning.findMany({
      include: { fact: true, conflictingFact: true },
    });

  it("flags a contradiction between chapters", async () => {
    await twoChaptersAbout(["grey", "brown"]);

    const [warning, ...rest] = await warnings();
    expect(rest).toEqual([]);
    expect(warning!.fact.value).toBe("brown");
    expect(warning!.conflictingFact.value).toBe("grey");
    expect(warning!.explanation).toBe("Pair 1 disagrees.");
  });

  it("reports a conflict once, even when several chapters state the same detail", async () => {
    const ids = [
      await addChapter(0, "Grey eyes."),
      await addChapter(1, "Still grey eyes."),
      await addChapter(2, "Brown eyes now."),
    ];
    llm.script.set(1, { summary: "", entities: [entity("Elspeth", [["eye colour", "grey"]])] });
    llm.script.set(2, { summary: "", entities: [entity("Elspeth", [["eye colour", "grey"]])] });
    llm.script.set(3, { summary: "", entities: [entity("Elspeth", [["eye colour", "brown"]])] });
    for (const id of ids) await processChapterMemory(llm, id);

    expect(await warnings()).toHaveLength(1);
  });

  it("doesn't ask the model about values that only differ in wording", async () => {
    await twoChaptersAbout(["Grey.", "grey"]);

    expect(llm.requests.filter((r) => r.task === "consistency")).toHaveLength(0);
    expect(await warnings()).toEqual([]);
  });

  it("trusts the model when it says a difference is fine", async () => {
    llm.judge = () => false;
    await twoChaptersAbout(["grey", "steel-grey"]);

    expect(llm.requests.filter((r) => r.task === "consistency")).toHaveLength(1);
    expect(await warnings()).toEqual([]);
  });

  it("never raises a dismissed conflict again, even after re-reading the chapters", async () => {
    const { second } = await twoChaptersAbout(["grey", "brown"]);
    const [warning] = await warnings();
    await prisma.dismissedConflict.create({
      data: { bookId: book.id, fingerprint: warning!.fingerprint },
    });

    await prisma.chapter.update({ where: { id: second }, data: { content: "Edited text." } });
    await processChapterMemory(llm, second);

    expect(await warnings()).toEqual([]);
  });
});

describe("queueing", () => {
  function recordingQueue() {
    const queued: string[] = [];
    const queue: MemoryQueue = { enqueueChapter: async (id) => void queued.push(id) };
    return { queue, queued };
  }

  it("queues a memory update when chapter text is saved, but not for a title change", async () => {
    const { queue, queued } = recordingQueue();
    const app = createApp({ llm, memoryQueue: queue });
    const chapterId = book.chapters[0]!.id;
    const url = `/books/${book.id}/chapters/${chapterId}`;

    await request(app).patch(url).set(bearer(alice.accessToken)).send({ title: "Renamed" });
    expect(queued).toEqual([]);

    await request(app).patch(url).set(bearer(alice.accessToken)).send({ content: "New text." });
    expect(queued).toEqual([chapterId]);
  });

  it("still saves the chapter if the queue is down", async () => {
    const failing: MemoryQueue = { enqueueChapter: () => Promise.reject(new Error("queue down")) };
    const app = createApp({ llm, memoryQueue: failing });

    const res = await request(app)
      .patch(`/books/${book.id}/chapters/${book.chapters[0]!.id}`)
      .set(bearer(alice.accessToken))
      .send({ content: "Saved anyway." });

    expect(res.status).toBe(200);
  });

  describe("with the real job queue", () => {
    let queue: PgBossMemoryQueue | undefined;
    afterEach(async () => {
      await queue?.stop();
      queue = undefined;
    });

    it("processes a saved chapter in the background", { timeout: 30_000 }, async () => {
      llm.script.set(1, { summary: "Background summary.", entities: [entity("Callum")] });
      queue = await PgBossMemoryQueue.start({
        connectionString: env.DATABASE_URL,
        llm,
        debounceSeconds: 1,
      });
      const app = createApp({ llm, memoryQueue: queue });
      const chapterId = book.chapters[0]!.id;

      await request(app)
        .patch(`/books/${book.id}/chapters/${chapterId}`)
        .set(bearer(alice.accessToken))
        .send({ content: "Callum rowed out at dawn." })
        .expect(200);

      let summary = "";
      for (let i = 0; i < 50 && !summary; i++) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        summary = (await prisma.chapter.findUniqueOrThrow({ where: { id: chapterId } })).summary;
      }
      expect(summary).toBe("Background summary.");
    });
  });
});
