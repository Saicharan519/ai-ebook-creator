import {
  bookSchema,
  publicBookSchema,
  publicChapterSchema,
  type Book,
  type ChapterSummary,
} from "@ebook/shared";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { bookSlug, slugify } from "../src/lib/slug";
import { bearer, createUser, resetDatabase, type TestUser } from "./helpers";

const app = createApp();

let alice: TestUser;
let book: Book;
let chapters: ChapterSummary[];

const asAlice = () => bearer(alice.accessToken);

async function addChapter(title: string, content: string) {
  const res = await request(app)
    .post(`/books/${book.id}/chapters`)
    .set(asAlice())
    .send({ title, content })
    .expect(201);
  return res.body as ChapterSummary;
}

const publish = () => request(app).post(`/books/${book.id}/publish`).set(asAlice());

beforeEach(async () => {
  await resetDatabase();
  alice = await createUser(app);
  const res = await request(app)
    .post("/books")
    .set(asAlice())
    .send({ title: "Rain & Ruin", author: "Alice", premise: "Private planning notes" });
  book = bookSchema.parse(res.body);
  // The book starts with an empty "Chapter 1"; give it text and add more
  await request(app)
    .patch(`/books/${book.id}/chapters/${book.chapters[0]!.id}`)
    .set(asAlice())
    .send({ title: "Opening", content: "Rain fell all night." })
    .expect(200);
  await addChapter("Planned, not written", "");
  await addChapter("The Flood", "The river rose.");
  const full = await request(app).get(`/books/${book.id}`).set(asAlice());
  chapters = bookSchema.parse(full.body).chapters;
});

describe("slugs", () => {
  it("turns titles into ASCII words", () => {
    expect(slugify("Rain & Ruin: Book Ü")).toBe("rain-ruin-book-u");
    expect(slugify("  Café   Noir!! ")).toBe("cafe-noir");
    expect(slugify("東京")).toBe("book");
    expect(slugify("a".repeat(100))).toHaveLength(60);
  });

  it("adds a random suffix so equal titles get different addresses", () => {
    const first = bookSlug("Rain");
    expect(first).toMatch(/^rain-[a-z0-9]{8}$/);
    expect(bookSlug("Rain")).not.toBe(first);
  });
});

describe("publishing", () => {
  it("publishes a book with a public slug", async () => {
    const res = await publish();

    expect(res.status).toBe(200);
    const published = bookSchema.parse(res.body);
    expect(published.status).toBe("published");
    expect(published.slug).toMatch(/^rain-ruin-[a-z0-9]{8}$/);
    expect(published.publishedAt).not.toBeNull();
  });

  it("keeps the same link when a book is unpublished and published again", async () => {
    const first = bookSchema.parse((await publish()).body);

    const unpublished = await request(app).delete(`/books/${book.id}/publish`).set(asAlice());
    expect(bookSchema.parse(unpublished.body)).toMatchObject({
      status: "draft",
      publishedAt: null,
      slug: first.slug,
    });

    expect(bookSchema.parse((await publish()).body).slug).toBe(first.slug);
  });

  it("refuses to publish a book with no text", async () => {
    const empty = await request(app)
      .post("/books")
      .set(asAlice())
      .send({ title: "Empty", author: "Alice" });

    const res = await request(app).post(`/books/${empty.body.id}/publish`).set(asAlice());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("NOTHING_TO_PUBLISH");
  });

  it("doesn't let the book status be changed through a regular update", async () => {
    const res = await request(app)
      .patch(`/books/${book.id}`)
      .set(asAlice())
      .send({ title: "Renamed", status: "published" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "Renamed", status: "draft", slug: null });
  });

  it("only lets the owner publish or unpublish", async () => {
    const bob = await createUser(app);
    expect(
      (await request(app).post(`/books/${book.id}/publish`).set(bearer(bob.accessToken))).status,
    ).toBe(404);
    expect(
      (await request(app).delete(`/books/${book.id}/publish`).set(bearer(bob.accessToken))).status,
    ).toBe(404);
  });
});

describe("public reader API", () => {
  it("shows a published book without a login, skipping empty chapters and private notes", async () => {
    const { slug } = bookSchema.parse((await publish()).body);

    const res = await request(app).get(`/public/books/${slug}`);

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=60");
    const publicBook = publicBookSchema.parse(res.body);
    expect(publicBook).toMatchObject({ title: "Rain & Ruin", author: "Alice", wordCount: 7 });
    expect(publicBook.chapters.map((c) => c.title)).toEqual(["Opening", "The Flood"]);
    expect(JSON.stringify(res.body)).not.toContain("Private planning notes");
  });

  it("serves a chapter with links to its neighbours", async () => {
    const { slug } = bookSchema.parse((await publish()).body);
    const [opening, , flood] = chapters;

    const res = await request(app).get(`/public/books/${slug}/chapters/${flood!.id}`);

    expect(res.status).toBe(200);
    expect(publicChapterSchema.parse(res.body)).toEqual({
      id: flood!.id,
      title: "The Flood",
      number: 2,
      content: "The river rose.",
      previous: { id: opening!.id, title: "Opening" },
      next: null,
    });
  });

  it("hides drafts, unpublished books, and empty chapters", async () => {
    const { slug } = bookSchema.parse((await publish()).body);
    const empty = chapters[1]!;

    expect((await request(app).get(`/public/books/${slug}/chapters/${empty.id}`)).status).toBe(404);

    await request(app).delete(`/books/${book.id}/publish`).set(asAlice()).expect(200);
    expect((await request(app).get(`/public/books/${slug}`)).status).toBe(404);
    expect(
      (await request(app).get(`/public/books/${slug}/chapters/${chapters[0]!.id}`)).status,
    ).toBe(404);
  });

  it("doesn't serve a chapter from a different book under this slug", async () => {
    const { slug } = bookSchema.parse((await publish()).body);
    const other = await request(app)
      .post("/books")
      .set(asAlice())
      .send({ title: "Other", author: "Alice" });

    const res = await request(app).get(
      `/public/books/${slug}/chapters/${other.body.chapters[0].id}`,
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 for malformed or unknown slugs", async () => {
    expect((await request(app).get("/public/books/Not_A_Slug")).status).toBe(404);
    expect((await request(app).get("/public/books/no-such-book-12345678")).status).toBe(404);
  });
});
