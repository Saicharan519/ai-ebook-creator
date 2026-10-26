import { bookSchema, type Book } from "@ebook/shared";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { makePng } from "./fixtures";
import { bearer, createUser, resetDatabase, type TestUser } from "./helpers";

const app = createApp();

let alice: TestUser;
let book: Book;

const SAMPLE_CHAPTER = [
  "# The Storm",
  "",
  "Rain fell **hard** and *fast*, with `code` in between.",
  "A second line in the same paragraph.",
  "",
  "1. First",
  "2. Second",
  "   - nested bullet",
  "",
  "> A quote with **bold** words.",
  "",
  "```",
  "const x = 1;",
  "```",
  "",
  "---",
  "",
  "<script>alert('not html')</script>",
].join("\n");

/** Collects a binary response body into a Buffer. */
function binary(res: request.Response, callback: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
}

function exportBook(format: string, user = alice) {
  return request(app)
    .get(`/books/${book.id}/export/${format}`)
    .set(bearer(user.accessToken))
    .buffer(true)
    .parse(binary);
}

beforeEach(async () => {
  await resetDatabase();
  alice = await createUser(app);
  const created = await request(app)
    .post("/books")
    .set(bearer(alice.accessToken))
    .send({ title: "Rain & Ruin: Book Ü", subtitle: "A story", author: "Alice" });
  book = bookSchema.parse(created.body);
  await request(app)
    .patch(`/books/${book.id}/chapters/${book.chapters[0]!.id}`)
    .set(bearer(alice.accessToken))
    .send({ title: "Opening", content: SAMPLE_CHAPTER })
    .expect(200);
});

describe("export", () => {
  it("exports a PDF", async () => {
    const res = await exportBook("pdf");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("exports a Word document", async () => {
    const res = await exportBook("docx");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("wordprocessingml.document");
    // .docx files are zip archives
    expect((res.body as Buffer).subarray(0, 2).toString()).toBe("PK");
  });

  it("names the download after the book, including non-ASCII titles", async () => {
    const res = await exportBook("pdf");

    const disposition = res.headers["content-disposition"];
    expect(disposition).toContain("attachment");
    expect(disposition).toContain(
      `filename*=UTF-8''${encodeURIComponent("Rain & Ruin: Book Ü.pdf")}`,
    );
  });

  it("embeds the cover image", async () => {
    const withoutCover = (await exportBook("pdf")).body as Buffer;
    await request(app)
      .put(`/books/${book.id}/cover`)
      .set(bearer(alice.accessToken))
      .attach("cover", makePng(300, 450), "cover.png")
      .expect(200);

    for (const format of ["pdf", "docx"]) {
      const res = await exportBook(format);
      expect(res.status).toBe(200);
    }
    const withCover = (await exportBook("pdf")).body as Buffer;
    expect(withCover.toString("latin1")).toContain("/Subtype /Image");
    expect(withoutCover.toString("latin1")).not.toContain("/Subtype /Image");
  });

  it("exports a book whose chapters are all empty", async () => {
    await request(app)
      .patch(`/books/${book.id}/chapters/${book.chapters[0]!.id}`)
      .set(bearer(alice.accessToken))
      .send({ content: "" });

    expect((await exportBook("pdf")).status).toBe(200);
    expect((await exportBook("docx")).status).toBe(200);
  });

  it("keeps other users out and rejects unknown formats", async () => {
    const bob = await createUser(app);

    expect((await exportBook("pdf", bob)).status).toBe(404);
    expect((await exportBook("epub")).status).toBe(404);
  });
});
