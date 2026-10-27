import { bookSchema, type Book } from "@ebook/shared";
import JSZip from "jszip";
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

  it("exports an EPUB with the mimetype first and uncompressed", async () => {
    const res = await exportBook("epub");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/epub+zip");
    const file = res.body as Buffer;
    // The first zip entry's header: signature, compression method 0 (stored), name "mimetype"
    expect(file.readUInt32LE(0)).toBe(0x04034b50);
    expect(file.readUInt16LE(8)).toBe(0);
    expect(file.subarray(30, 38).toString()).toBe("mimetype");
    expect(file.subarray(38, 58).toString()).toBe("application/epub+zip");
  });

  it("builds the EPUB package, contents, and escaped chapter pages", async () => {
    await request(app)
      .post(`/books/${book.id}/chapters`)
      .set(bearer(alice.accessToken))
      .send({ title: "Fire & <Ice>", content: "Second chapter." })
      .expect(201);

    const zip = await JSZip.loadAsync((await exportBook("epub")).body as Buffer);
    const read = (path: string) => zip.file(path)!.async("string");

    expect(await read("META-INF/container.xml")).toContain('full-path="OEBPS/content.opf"');
    const opf = await read("OEBPS/content.opf");
    expect(opf).toContain(`<dc:identifier id="book-id">urn:uuid:${book.id}</dc:identifier>`);
    expect(opf).toContain("<dc:title>Rain &amp; Ruin: Book Ü</dc:title>");
    expect(opf).toMatch(
      /<meta property="dcterms:modified">\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ<\/meta>/,
    );
    expect(opf).toContain('properties="nav"');
    expect(opf).toContain('<itemref idref="chapter-2"/>');

    const nav = await read("OEBPS/nav.xhtml");
    expect(nav).toContain('<a href="chapter-1.xhtml">Opening</a>');
    expect(nav).toContain('<a href="chapter-2.xhtml">Fire &amp; &lt;Ice&gt;</a>');
    expect(await read("OEBPS/toc.ncx")).toContain('<content src="chapter-2.xhtml"/>');

    const chapter = await read("OEBPS/chapter-1.xhtml");
    expect(chapter).toContain("<h1>Opening</h1>");
    expect(chapter).toContain("<h2>The Storm</h2>");
    expect(chapter).toContain("Rain fell <strong>hard</strong> and <em>fast</em>");
    expect(chapter).toContain("&lt;script&gt;alert(&apos;not html&apos;)&lt;/script&gt;");
    expect(chapter).not.toContain("<script>");
  });

  it("adds the cover to the EPUB", async () => {
    await request(app)
      .put(`/books/${book.id}/cover`)
      .set(bearer(alice.accessToken))
      .attach("cover", makePng(300, 450), "cover.png")
      .expect(200);

    const zip = await JSZip.loadAsync((await exportBook("epub")).body as Buffer);
    expect(zip.file("OEBPS/cover.png")).not.toBeNull();
    const opf = await zip.file("OEBPS/content.opf")!.async("string");
    expect(opf).toContain('properties="cover-image"');
    expect(opf).toContain('<itemref idref="cover"/>');
  });

  it("adds a linked table of contents to the PDF and Word exports", async () => {
    const pdf = ((await exportBook("pdf")).body as Buffer).toString("latin1");
    // A sidebar outline and named destinations for the contents links
    expect(pdf).toContain("/Outlines");
    expect(pdf).toContain("/Dests");

    const docx = await JSZip.loadAsync((await exportBook("docx")).body as Buffer);
    const document = await docx.file("word/document.xml")!.async("string");
    expect(document).toContain("Contents");
    expect(document).toContain('w:anchor="chapter_1"');
    expect(document).toContain('w:name="chapter_1"');
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
    expect((await exportBook("mobi")).status).toBe(404);
  });
});
