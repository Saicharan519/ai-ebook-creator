import { bookSchema, storyBibleSchema, storyEntitySchema, type Book } from "@ebook/shared";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/db";
import type { MemoryQueue } from "../src/modules/memory/memory-queue";
import { processChapterMemory } from "../src/modules/memory/pipeline";
import { bearer, createUser, resetDatabase, type TestUser } from "./helpers";
import { entity, ScriptedMemoryModel } from "./scripted-model";

let llm: ScriptedMemoryModel;
let queued: string[];
let app: ReturnType<typeof createApp>;
let alice: TestUser;
let book: Book;
let chapterIds: string[];

beforeEach(async () => {
  await resetDatabase();
  llm = new ScriptedMemoryModel();
  queued = [];
  const memoryQueue: MemoryQueue = { enqueueChapter: async (id) => void queued.push(id) };
  app = createApp({ llm, memoryQueue });
  alice = await createUser(app);
  const created = await request(app)
    .post("/books")
    .set(bearer(alice.accessToken))
    .send({ title: "The Lighthouse", author: "Alice" });
  book = bookSchema.parse(created.body);

  await prisma.chapter.update({
    where: { id: book.chapters[0]!.id },
    data: { content: "Elspeth's grey eyes." },
  });
  const second = await prisma.chapter.create({
    data: { bookId: book.id, position: 1, title: "Chapter 2", content: "Elspeth's brown eyes." },
  });
  chapterIds = [book.chapters[0]!.id, second.id];
  llm.script.set(1, {
    summary: "",
    entities: [entity("Elspeth Gunn", [["eye colour", "grey"]], { excerpt: "grey eyes" })],
  });
  llm.script.set(2, {
    summary: "",
    entities: [entity("Elspeth Gunn", [["eye colour", "brown"]], { excerpt: "brown eyes" })],
  });
  for (const id of chapterIds) await processChapterMemory(llm, id);
});

const asAlice = () => bearer(alice.accessToken);
const getBible = async () =>
  storyBibleSchema.parse(
    (await request(app).get(`/books/${book.id}/story-bible`).set(asAlice()).expect(200)).body,
  );

describe("Story Bible", () => {
  it("lists entries with details, appearances, open warnings, and processing status", async () => {
    await prisma.chapter.create({
      data: { bookId: book.id, position: 2, title: "Chapter 3", content: "Not read yet." },
    });

    const bible = await getBible();

    const [elspeth] = bible.entities;
    expect(elspeth).toMatchObject({ name: "Elspeth Gunn", kind: "character", source: "ai" });
    expect(elspeth!.facts.map((f) => [f.value, f.chapter?.position])).toEqual([
      ["grey", 0],
      ["brown", 1],
    ]);
    expect(elspeth!.appearances.map((a) => a.excerpt)).toEqual(["grey eyes", "brown eyes"]);

    expect(bible.warnings).toHaveLength(1);
    expect(bible.warnings[0]).toMatchObject({
      entityName: "Elspeth Gunn",
      attribute: "eye colour",
      fact: { value: "brown", chapter: { position: 1 } },
      conflictingFact: { value: "grey", chapter: { position: 0 } },
    });
    expect(bible.status).toEqual({ enabled: true, pendingChapters: 1 });
    // The unread chapter is queued, so it doesn't stay "Reading…" forever
    expect(queued).toHaveLength(1);
  });

  it("is private to the book's owner", async () => {
    const bob = await createUser(app);
    const res = await request(app)
      .get(`/books/${book.id}/story-bible`)
      .set(bearer(bob.accessToken));
    expect(res.status).toBe(404);

    const [elspeth] = (await getBible()).entities;
    const edit = await request(app)
      .patch(`/books/${book.id}/entities/${elspeth!.id}`)
      .set(bearer(bob.accessToken))
      .send({ pinned: true });
    expect(edit.status).toBe(404);
  });

  it("lets the author add an entry, which is pinned and theirs", async () => {
    const res = await request(app)
      .post(`/books/${book.id}/entities`)
      .set(asAlice())
      .send({ kind: "place", name: "Eilean Dubh", description: "The island." });

    expect(res.status).toBe(201);
    expect(storyEntitySchema.parse(res.body)).toMatchObject({
      name: "Eilean Dubh",
      source: "author",
      pinned: true,
    });
  });

  it("keeps the old name as an alias when an entry is renamed, and marks it as the author's", async () => {
    const [elspeth] = (await getBible()).entities;

    const res = await request(app)
      .patch(`/books/${book.id}/entities/${elspeth!.id}`)
      .set(asAlice())
      .send({ name: "Elspeth MacLeod", description: "The keeper's daughter." });

    expect(res.body).toMatchObject({
      name: "Elspeth MacLeod",
      aliases: ["Elspeth Gunn"],
      source: "author",
      description: "The keeper's daughter.",
    });
  });

  it("pinning doesn't take over an AI entry", async () => {
    const [elspeth] = (await getBible()).entities;

    const res = await request(app)
      .patch(`/books/${book.id}/entities/${elspeth!.id}`)
      .set(asAlice())
      .send({ pinned: true });

    expect(res.body).toMatchObject({ pinned: true, source: "ai" });
  });

  it("adds and removes the author's own details", async () => {
    const [elspeth] = (await getBible()).entities;
    const url = `/books/${book.id}/entities/${elspeth!.id}/facts`;

    const added = await request(app)
      .post(url)
      .set(asAlice())
      .send({ attribute: "Hair Color", value: "red" });
    const fact = storyEntitySchema.parse(added.body).facts.find((f) => f.source === "author")!;
    expect(fact).toMatchObject({ attribute: "hair colour", value: "red", chapter: null });

    const removed = await request(app).delete(`${url}/${fact.id}`).set(asAlice());
    expect(removed.body.facts.some((f: { id: string }) => f.id === fact.id)).toBe(false);
  });

  it("dismisses a warning for good", async () => {
    const [warning] = (await getBible()).warnings;

    await request(app)
      .post(`/books/${book.id}/warnings/${warning!.id}/dismiss`)
      .set(asAlice())
      .expect(204);
    expect((await getBible()).warnings).toEqual([]);

    // Re-reading the chapter recreates the facts but not the warning
    await prisma.chapter.update({
      where: { id: chapterIds[1] },
      data: { content: "Elspeth's brown eyes, again." },
    });
    await processChapterMemory(llm, chapterIds[1]!);
    expect((await getBible()).warnings).toEqual([]);
  });

  it("queues every chapter with text when asked to refresh", async () => {
    const res = await request(app).post(`/books/${book.id}/memory/refresh`).set(asAlice());

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ queued: 2 });
    expect(queued).toEqual(chapterIds);
  });

  it("reports when AI isn't configured", async () => {
    const res = await request(createApp({ llm: null }))
      .get(`/books/${book.id}/story-bible`)
      .set(asAlice());
    expect(res.body.status.enabled).toBe(false);
  });
});
