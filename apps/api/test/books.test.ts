import { bookSchema, bookSummarySchema, type Book } from "@ebook/shared";
import { existsSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/db";
import { storage } from "../src/lib/storage";
import { makePng } from "./fixtures";
import { bearer, createUser, resetDatabase, type TestUser } from "./helpers";

const app = createApp();

let alice: TestUser;
let bob: TestUser;

beforeEach(async () => {
  await resetDatabase();
  alice = await createUser(app, { name: "Alice" });
  bob = await createUser(app, { name: "Bob" });
});

async function createBook(user: TestUser, input: Record<string, unknown> = {}): Promise<Book> {
  const res = await request(app)
    .post("/books")
    .set(bearer(user.accessToken))
    .send({ title: "The Long Road", author: user.user.name, ...input })
    .expect(201);
  return bookSchema.parse(res.body);
}

function coverFilePath(coverUrl: string) {
  return path.join(storage.rootDir, coverUrl.split("/uploads/")[1]!);
}

describe("books", () => {
  it("requires authentication", async () => {
    expect((await request(app).get("/books")).status).toBe(401);
    expect((await request(app).post("/books").send({ title: "x", author: "y" })).status).toBe(401);
  });

  it("creates a book with one empty chapter and trimmed fields", async () => {
    const book = await createBook(alice, {
      title: "  The Long Road  ",
      genre: "Fantasy",
      premise: "A courier crosses a broken empire.",
    });

    expect(book.title).toBe("The Long Road");
    expect(book).toMatchObject({ genre: "Fantasy", status: "draft", coverUrl: null });
    expect(book.chapters).toHaveLength(1);
    expect(book.chapters[0]).toMatchObject({ title: "Chapter 1", position: 0, wordCount: 0 });
  });

  it("validates new books", async () => {
    const res = await request(app)
      .post("/books")
      .set(bearer(alice.accessToken))
      .send({ title: "", author: "" });

    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual(["author", "title"]);
  });

  it("lists only the user's own books, most recently updated first", async () => {
    const first = await createBook(alice, { title: "First" });
    const second = await createBook(alice, { title: "Second" });
    await createBook(bob, { title: "Bob's book" });
    await request(app)
      .patch(`/books/${first.id}`)
      .set(bearer(alice.accessToken))
      .send({ subtitle: "Edited" });

    const res = await request(app).get("/books").set(bearer(alice.accessToken));

    expect(res.status).toBe(200);
    const books = bookSummarySchema.array().parse(res.body);
    expect(books.map((book) => book.id)).toEqual([first.id, second.id]);
  });

  it("hides other users' books behind a 404", async () => {
    const book = await createBook(alice);
    const asBob = bearer(bob.accessToken);

    expect((await request(app).get(`/books/${book.id}`).set(asBob)).status).toBe(404);
    expect(
      (await request(app).patch(`/books/${book.id}`).set(asBob).send({ title: "Mine now" })).status,
    ).toBe(404);
    expect((await request(app).delete(`/books/${book.id}`).set(asBob)).status).toBe(404);

    const unchanged = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(unchanged.title).toBe("The Long Road");
  });

  it("returns 404 for malformed ids", async () => {
    const res = await request(app).get("/books/not-a-uuid").set(bearer(alice.accessToken));
    expect(res.status).toBe(404);
  });

  it("updates allowed fields and ignores attempts to change the owner, cover, or status", async () => {
    const book = await createBook(alice);

    const res = await request(app)
      .patch(`/books/${book.id}`)
      .set(bearer(alice.accessToken))
      .send({ title: "Renamed", status: "published", ownerId: bob.user.id, coverKey: "../.env" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "Renamed", status: "draft", coverUrl: null });
    const row = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(row.ownerId).toBe(alice.user.id);
    expect(row.coverKey).toBeNull();
  });

  it("deletes a book together with its chapters", async () => {
    const book = await createBook(alice);

    const res = await request(app).delete(`/books/${book.id}`).set(bearer(alice.accessToken));

    expect(res.status).toBe(204);
    expect(await prisma.book.count({ where: { id: book.id } })).toBe(0);
    expect(await prisma.chapter.count({ where: { bookId: book.id } })).toBe(0);
  });
});

describe("book covers", () => {
  it("uploads a PNG cover, serves it publicly, and replaces it cleanly", async () => {
    const book = await createBook(alice);
    const upload = () =>
      request(app)
        .put(`/books/${book.id}/cover`)
        .set(bearer(alice.accessToken))
        .attach("cover", makePng(4, 6), "cover.png");

    const first = bookSchema.parse((await upload().expect(200)).body);
    expect(first.coverUrl).toMatch(/\/uploads\/covers\/.+\.png$/);

    const served = await request(app).get(new URL(first.coverUrl!).pathname);
    expect(served.status).toBe(200);
    expect(served.headers["content-type"]).toBe("image/png");
    expect(served.headers["cross-origin-resource-policy"]).toBe("cross-origin");

    const second = bookSchema.parse((await upload().expect(200)).body);
    expect(second.coverUrl).not.toBe(first.coverUrl);
    expect(existsSync(coverFilePath(first.coverUrl!))).toBe(false);
    expect(existsSync(coverFilePath(second.coverUrl!))).toBe(true);
  });

  it("rejects files that aren't really images, whatever their name says", async () => {
    const book = await createBook(alice);

    const res = await request(app)
      .put(`/books/${book.id}/cover`)
      .set(bearer(alice.accessToken))
      .attach("cover", Buffer.from("<script>alert(1)</script>"), {
        filename: "cover.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("UNSUPPORTED_IMAGE");
  });

  it("rejects covers over 2 MB", async () => {
    const book = await createBook(alice);
    const tooBig = Buffer.concat([makePng(1, 1), Buffer.alloc(2 * 1024 * 1024)]);

    const res = await request(app)
      .put(`/books/${book.id}/cover`)
      .set(bearer(alice.accessToken))
      .attach("cover", tooBig, "cover.png");

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("doesn't let other users change a cover", async () => {
    const book = await createBook(alice);

    const res = await request(app)
      .put(`/books/${book.id}/cover`)
      .set(bearer(bob.accessToken))
      .attach("cover", makePng(2, 2), "cover.png");

    expect(res.status).toBe(404);
  });

  it("removes the cover file when the cover or the book is deleted", async () => {
    const book = await createBook(alice);
    const withCover = await request(app)
      .put(`/books/${book.id}/cover`)
      .set(bearer(alice.accessToken))
      .attach("cover", makePng(2, 2), "cover.png");
    const file = coverFilePath(withCover.body.coverUrl);

    const removed = await request(app)
      .delete(`/books/${book.id}/cover`)
      .set(bearer(alice.accessToken));
    expect(removed.body.coverUrl).toBeNull();
    expect(existsSync(file)).toBe(false);

    const again = await request(app)
      .put(`/books/${book.id}/cover`)
      .set(bearer(alice.accessToken))
      .attach("cover", makePng(2, 2), "cover.png");
    await request(app).delete(`/books/${book.id}`).set(bearer(alice.accessToken)).expect(204);
    expect(existsSync(coverFilePath(again.body.coverUrl))).toBe(false);
  });
});
