import { bookSchema, type Book } from "@ebook/shared";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/db";
import { assembleMemoryContext, describeEntity } from "../src/modules/ai/context-builder";
import { processChapterMemory } from "../src/modules/memory/pipeline";
import { bearer, createUser, resetDatabase, type TestUser } from "./helpers";
import { entity, ScriptedMemoryModel } from "./scripted-model";

describe("assembleMemoryContext", () => {
  it("fills sections in priority order within the budget", () => {
    const context = assembleMemoryContext(
      {
        entities: ["A".repeat(40), "B".repeat(40)],
        summaries: [{ position: 1, text: "S".repeat(40) }],
        passages: ["P".repeat(40)],
      },
      100,
    );

    // Two entities (82 chars incl. separators) fit; the summary would overflow, and so would the passage
    expect(context.storyBible.split("\n")).toHaveLength(2);
    expect(context.earlierChapters).toBe("");
    expect(context.relatedPassages).toBe("");
  });

  it("keeps the most recent summaries but presents them in reading order", () => {
    const context = assembleMemoryContext(
      {
        entities: [],
        summaries: [
          { position: 4, text: "five" },
          { position: 3, text: "four" },
          { position: 0, text: "one".repeat(100) },
        ],
        passages: [],
      },
      50,
    );

    expect(context.earlierChapters).toBe("four\nfive");
  });
});

describe("describeEntity", () => {
  it("lists aliases and de-duplicated details with their chapters", () => {
    const line = describeEntity({
      name: "Elspeth Gunn",
      kind: "character",
      aliases: ["Elspeth"],
      description: "The keeper's daughter.",
      pinned: false,
      facts: [
        { attribute: "eye colour", value: "grey", chapter: { position: 0 } },
        { attribute: "eye colour", value: "Grey", chapter: { position: 2 } },
        { attribute: "boat", value: "the Kittiwake", chapter: null },
      ],
    });

    expect(line).toBe(
      "Elspeth Gunn (character; also Elspeth). The keeper's daughter. " +
        "Details: eye colour: grey (ch. 1); boat: the Kittiwake (author).",
    );
  });
});

describe("AI requests use Story Memory", () => {
  let llm: ScriptedMemoryModel;
  let app: ReturnType<typeof createApp>;
  let alice: TestUser;
  let book: Book;
  let chapterIds: string[];

  beforeEach(async () => {
    await resetDatabase();
    llm = new ScriptedMemoryModel();
    app = createApp({ llm });
    alice = await createUser(app);
    const created = await request(app)
      .post("/books")
      .set(bearer(alice.accessToken))
      .send({ title: "The Lighthouse", author: "Alice" });
    book = bookSchema.parse(created.body);

    const texts = [
      "Callum rowed the ferry across the black water, his brass lantern swinging from the bow.",
      "Elspeth waited on the pier for the ferry.",
      "Years later, Elspeth buried Callum on the hill.",
    ];
    llm.script.set(1, {
      summary: "Callum ferries Elspeth across with his lantern.",
      entities: [entity("Callum", [["eye colour", "blue"]]), entity("Elspeth Gunn")],
    });
    llm.script.set(2, {
      summary: "Elspeth waits on the pier.",
      entities: [entity("Elspeth Gunn")],
    });
    llm.script.set(3, {
      summary: "SPOILER: Callum dies.",
      entities: [entity("Callum", [["status", "dead"]])],
    });

    await prisma.chapter.update({
      where: { id: book.chapters[0]!.id },
      data: { content: texts[0] },
    });
    chapterIds = [book.chapters[0]!.id];
    for (const [i, content] of texts.slice(1).entries()) {
      const chapter = await prisma.chapter.create({
        data: { bookId: book.id, position: i + 1, title: `Chapter ${i + 2}`, content },
      });
      chapterIds.push(chapter.id);
    }
    for (const id of chapterIds) await processChapterMemory(llm, id);
  });

  const inline = (chapterIndex: number, body: object, provider = llm) =>
    request(createApp({ llm: provider }))
      .post(`/books/${book.id}/chapters/${chapterIds[chapterIndex]}/ai/inline`)
      .set(bearer(alice.accessToken))
      .send(body);

  it("includes relevant entities, earlier summaries, and related passages", async () => {
    await inline(1, { action: "rewrite", selection: "Callum held up his brass lantern." }).expect(
      200,
    );

    const { prompt } = llm.requests.at(-1)!;
    expect(prompt).toMatch(
      /<story_bible>[\s\S]*Callum \(character\)[\s\S]*eye colour: blue \(ch\. 1\)/,
    );
    expect(prompt).toContain("<earlier_chapters>");
    expect(prompt).toContain("Callum ferries Elspeth across with his lantern.");
    expect(prompt).toMatch(/<related_passages>[\s\S]*From chapter 1[\s\S]*brass lantern swinging/);
    expect(prompt).toContain("Stay consistent with <story_bible>");
  });

  it("never reveals later chapters when writing an earlier one", async () => {
    await inline(1, { action: "continue", before: "Elspeth looked for Callum." }).expect(200);

    const { prompt } = llm.requests.at(-1)!;
    expect(prompt).not.toContain("SPOILER");
    // Facts from later chapters can still appear in the Story Bible; summaries can't
    expect(prompt).not.toMatch(/<earlier_chapters>[\s\S]*Chapter 3/);
  });

  it("always includes pinned entries", async () => {
    const morag = await prisma.entity.create({
      data: { bookId: book.id, kind: "character", name: "Morag", pinned: true, source: "author" },
    });
    await prisma.fact.create({
      data: { entityId: morag.id, attribute: "role", value: "harbourmaster", source: "author" },
    });

    await inline(1, { action: "continue", before: "The tide turned." }).expect(200);

    expect(llm.requests.at(-1)!.prompt).toContain(
      "Morag (character). Details: role: harbourmaster (author).",
    );
  });

  it("keeps the Story Bible and summaries when only passage search fails", async () => {
    const noEmbeddings = new ScriptedMemoryModel();
    noEmbeddings.embed = () => Promise.reject(new Error("embedding service down"));

    const res = await inline(
      1,
      { action: "rewrite", selection: "Callum's lantern." },
      noEmbeddings,
    );

    expect(res.status).toBe(200);
    const { prompt } = noEmbeddings.requests.at(-1)!;
    expect(prompt).toContain("<story_bible>");
    expect(prompt).toContain("<earlier_chapters>");
    expect(prompt).not.toContain("<related_passages>");
  });
});
