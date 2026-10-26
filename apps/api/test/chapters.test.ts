import { bookSchema, chapterSchema, type Book } from "@ebook/shared";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { bearer, createUser, resetDatabase, type TestUser } from "./helpers";

const app = createApp();

let alice: TestUser;
let bob: TestUser;
let book: Book;

beforeEach(async () => {
  await resetDatabase();
  alice = await createUser(app);
  bob = await createUser(app);
  const res = await request(app)
    .post("/books")
    .set(bearer(alice.accessToken))
    .send({ title: "Book", author: "Alice" });
  book = bookSchema.parse(res.body);
});

const asAlice = () => bearer(alice.accessToken);

async function addChapter(input: Record<string, unknown> = {}) {
  const res = await request(app)
    .post(`/books/${book.id}/chapters`)
    .set(asAlice())
    .send(input)
    .expect(201);
  return chapterSchema.parse(res.body);
}

async function chapterTitlesInOrder() {
  const res = await request(app).get(`/books/${book.id}`).set(asAlice());
  return bookSchema.parse(res.body).chapters.map((chapter) => chapter.title);
}

describe("chapters", () => {
  it("appends new chapters with the next position and a default title", async () => {
    const second = await addChapter();
    const third = await addChapter({ title: "The Storm", content: "Rain fell **hard** today." });

    expect(second).toMatchObject({ title: "Chapter 2", position: 1 });
    expect(third).toMatchObject({ title: "The Storm", position: 2, wordCount: 4 });
  });

  it("returns a chapter with its content", async () => {
    const chapter = await addChapter({ content: "Once upon a time" });

    const res = await request(app).get(`/books/${book.id}/chapters/${chapter.id}`).set(asAlice());

    expect(res.status).toBe(200);
    expect(chapterSchema.parse(res.body).content).toBe("Once upon a time");
  });

  it("updates content, recounts words, and bumps the book's updated time", async () => {
    const chapter = await addChapter();
    const before = book.updatedAt;

    const res = await request(app)
      .patch(`/books/${book.id}/chapters/${chapter.id}`)
      .set(asAlice())
      .send({ content: "# Heading\n\nOne two three — four." });

    expect(res.status).toBe(200);
    expect(res.body.wordCount).toBe(5);
    const updatedBook = await request(app).get(`/books/${book.id}`).set(asAlice());
    expect(new Date(updatedBook.body.updatedAt).getTime()).toBeGreaterThan(
      new Date(before).getTime(),
    );
  });

  it("deletes a chapter and closes the gap in positions", async () => {
    const second = await addChapter({ title: "Two" });
    await addChapter({ title: "Three" });

    await request(app).delete(`/books/${book.id}/chapters/${second.id}`).set(asAlice()).expect(204);

    const res = await request(app).get(`/books/${book.id}`).set(asAlice());
    const chapters = bookSchema.parse(res.body).chapters;
    expect(chapters.map((c) => [c.title, c.position])).toEqual([
      ["Chapter 1", 0],
      ["Three", 1],
    ]);
  });

  it("reorders chapters", async () => {
    const [first] = book.chapters;
    const second = await addChapter({ title: "Two" });
    const third = await addChapter({ title: "Three" });

    const res = await request(app)
      .patch(`/books/${book.id}/chapters/order`)
      .set(asAlice())
      .send({ chapterIds: [third.id, first!.id, second.id] });

    expect(res.status).toBe(200);
    expect(await chapterTitlesInOrder()).toEqual(["Three", "Chapter 1", "Two"]);
  });

  it("rejects a reorder that doesn't list every chapter exactly once", async () => {
    const [first] = book.chapters;
    const second = await addChapter();
    const reorder = (chapterIds: string[]) =>
      request(app).patch(`/books/${book.id}/chapters/order`).set(asAlice()).send({ chapterIds });

    expect((await reorder([first!.id])).status).toBe(400);
    expect((await reorder([first!.id, first!.id])).status).toBe(400);
    expect((await reorder([first!.id, second.id, crypto.randomUUID()])).status).toBe(400);
    expect(await chapterTitlesInOrder()).toEqual(["Chapter 1", "Chapter 2"]);
  });

  it("hides chapters from other users", async () => {
    const chapter = await addChapter({ content: "secret draft" });
    const asBob = bearer(bob.accessToken);
    const url = `/books/${book.id}/chapters/${chapter.id}`;

    expect((await request(app).get(url).set(asBob)).status).toBe(404);
    expect((await request(app).patch(url).set(asBob).send({ content: "hacked" })).status).toBe(404);
    expect((await request(app).delete(url).set(asBob)).status).toBe(404);
    expect((await request(app).post(`/books/${book.id}/chapters`).set(asBob).send({})).status).toBe(
      404,
    );

    const res = await request(app).get(url).set(asAlice());
    expect(res.body.content).toBe("secret draft");
  });

  it("doesn't find a chapter through a different book's URL", async () => {
    const chapter = await addChapter();
    const other = await request(app)
      .post("/books")
      .set(asAlice())
      .send({ title: "Other", author: "Alice" });

    const res = await request(app)
      .get(`/books/${other.body.id}/chapters/${chapter.id}`)
      .set(asAlice());

    expect(res.status).toBe(404);
  });
});
