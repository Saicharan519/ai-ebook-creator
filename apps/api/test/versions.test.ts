import {
  bookSchema,
  branchSchema,
  branchSummarySchema,
  chapterSchema,
  restoreResultSchema,
  versionSchema,
  versionSummarySchema,
  type Book,
  type Chapter,
} from "@ebook/shared";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/db";
import type { MemoryQueue } from "../src/modules/memory/memory-queue";
import { AUTOSAVES_KEPT } from "../src/modules/versions/snapshots";
import { bearer, createUser, resetDatabase, type TestUser } from "./helpers";

const queued: string[] = [];
const memoryQueue: MemoryQueue = { enqueueChapter: async (id) => void queued.push(id) };
const app = createApp({ memoryQueue });

let alice: TestUser;
let bob: TestUser;
let book: Book;
let chapter: Chapter;

const asAlice = () => bearer(alice.accessToken);
const asBob = () => bearer(bob.accessToken);
const chapterPath = () => `/books/${book.id}/chapters/${chapter.id}`;

beforeEach(async () => {
  await resetDatabase();
  queued.length = 0;
  alice = await createUser(app);
  bob = await createUser(app);
  const created = await request(app)
    .post("/books")
    .set(asAlice())
    .send({ title: "Book", author: "Alice" });
  book = bookSchema.parse(created.body);
  const res = await request(app)
    .post(`/books/${book.id}/chapters`)
    .set(asAlice())
    .send({ title: "The Storm", content: "Rain fell all night." })
    .expect(201);
  chapter = chapterSchema.parse(res.body);
});

const saveText = (content: string) =>
  request(app).patch(chapterPath()).set(asAlice()).send({ content }).expect(200);

async function listVersions(branchId?: string) {
  const res = await request(app)
    .get(`${chapterPath()}/versions`)
    .query(branchId ? { branchId } : {})
    .set(asAlice())
    .expect(200);
  return versionSummarySchema.array().parse(res.body);
}

/** Pretends every snapshot so far was taken 11 minutes ago */
const ageSnapshots = () =>
  prisma.chapterVersion.updateMany({
    data: { createdAt: new Date(Date.now() - 11 * 60 * 1000) },
  });

async function createBranch(name = "Darker ending", body: Record<string, unknown> = {}) {
  const res = await request(app)
    .post(`${chapterPath()}/branches`)
    .set(asAlice())
    .send({ name, ...body })
    .expect(201);
  return branchSchema.parse(res.body);
}

describe("version history", () => {
  it("saves a version on request and skips an identical one", async () => {
    const first = await request(app)
      .post(`${chapterPath()}/versions`)
      .set(asAlice())
      .send({ label: "First draft" });
    expect(first.status).toBe(201);
    expect(versionSchema.parse(first.body)).toMatchObject({
      reason: "manual",
      label: "First draft",
      title: "The Storm",
      content: "Rain fell all night.",
      wordCount: 4,
      branchId: null,
    });

    const again = await request(app).post(`${chapterPath()}/versions`).set(asAlice()).send({});
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(first.body.id);
    expect(await listVersions()).toHaveLength(1);
  });

  it("only lets the client ask for manual and before-AI snapshots", async () => {
    const res = await request(app)
      .post(`${chapterPath()}/versions`)
      .set(asAlice())
      .send({ reason: "before_keep" });
    expect(res.status).toBe(400);
  });

  it("autosaves keep the text from before the save, at most every 10 minutes", async () => {
    await saveText("Rain fell all night. The river rose.");
    let versions = await listVersions();
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ reason: "autosave", wordCount: 4 });

    // Within 10 minutes of the last snapshot: no new one
    await saveText("Rain fell all night. The river rose. Then the bridge went.");
    expect(await listVersions()).toHaveLength(1);

    await ageSnapshots();
    await saveText("Something else entirely.");
    versions = await listVersions();
    expect(versions).toHaveLength(2);
    const latest = await request(app)
      .get(`${chapterPath()}/versions/${versions[0]!.id}`)
      .set(asAlice())
      .expect(200);
    expect(latest.body.content).toBe("Rain fell all night. The river rose. Then the bridge went.");
  });

  it("doesn't snapshot an empty chapter or a title-only change", async () => {
    const empty = await request(app)
      .post(`/books/${book.id}/chapters`)
      .set(asAlice())
      .send({})
      .expect(201);
    await request(app)
      .patch(`/books/${book.id}/chapters/${empty.body.id}`)
      .set(asAlice())
      .send({ content: "First words." })
      .expect(200);
    await request(app).patch(chapterPath()).set(asAlice()).send({ title: "Renamed" }).expect(200);

    expect(await prisma.chapterVersion.count()).toBe(0);
  });

  it(`prunes autosaves beyond the newest ${AUTOSAVES_KEPT} but keeps manual versions`, async () => {
    await request(app).post(`${chapterPath()}/versions`).set(asAlice()).send({}).expect(201);
    await saveText("Middle text.");
    await ageSnapshots();
    await prisma.chapterVersion.createMany({
      data: Array.from({ length: AUTOSAVES_KEPT }, (_, i) => ({
        chapterId: chapter.id,
        reason: "autosave" as const,
        title: "The Storm",
        content: `Old text ${i}`,
        wordCount: 3,
        createdAt: new Date(Date.now() - (60 + i) * 60 * 1000),
      })),
    });

    await saveText("New text.");

    const versions = await prisma.chapterVersion.findMany({ where: { chapterId: chapter.id } });
    expect(versions.filter((v) => v.reason === "autosave")).toHaveLength(AUTOSAVES_KEPT);
    expect(versions.filter((v) => v.reason === "manual")).toHaveLength(1);
    expect(versions.some((v) => v.content === `Old text ${AUTOSAVES_KEPT - 1}`)).toBe(false);
  });

  it("restores a version, saving the current text first, and updates Story Memory", async () => {
    const saved = await request(app).post(`${chapterPath()}/versions`).set(asAlice()).send({});
    await request(app).patch(chapterPath()).set(asAlice()).send({
      title: "A New Title",
      content: "I deleted everything by mistake.",
    });
    queued.length = 0;

    const res = await request(app)
      .post(`${chapterPath()}/versions/${saved.body.id}/restore`)
      .set(asAlice());

    expect(res.status).toBe(200);
    const result = restoreResultSchema.parse(res.body);
    expect(result).toMatchObject({
      target: "main",
      chapter: { title: "The Storm", content: "Rain fell all night.", wordCount: 4 },
    });
    const versions = await listVersions();
    expect(versions[0]).toMatchObject({ reason: "before_restore", title: "A New Title" });
    expect(queued).toEqual([chapter.id]);
  });

  it("hides another user's versions", async () => {
    const saved = await request(app).post(`${chapterPath()}/versions`).set(asAlice()).send({});
    const versionPath = `${chapterPath()}/versions/${saved.body.id}`;

    expect((await request(app).get(`${chapterPath()}/versions`).set(asBob())).status).toBe(404);
    expect((await request(app).post(`${chapterPath()}/versions`).set(asBob())).status).toBe(404);
    expect((await request(app).get(versionPath).set(asBob())).status).toBe(404);
    expect((await request(app).post(`${versionPath}/restore`).set(asBob())).status).toBe(404);
  });

  it("returns 404 for a version from a different chapter", async () => {
    const saved = await request(app).post(`${chapterPath()}/versions`).set(asAlice()).send({});
    const other = await request(app)
      .post(`/books/${book.id}/chapters`)
      .set(asAlice())
      .send({})
      .expect(201);

    const res = await request(app)
      .post(`/books/${book.id}/chapters/${other.body.id}/versions/${saved.body.id}/restore`)
      .set(asAlice());
    expect(res.status).toBe(404);
  });
});

describe("what-if branches", () => {
  it("starts a branch from the main text and edits it without touching the main text", async () => {
    const branch = await createBranch();
    expect(branch).toMatchObject({ name: "Darker ending", content: "Rain fell all night." });

    const res = await request(app)
      .patch(`${chapterPath()}/branches/${branch.id}`)
      .set(asAlice())
      .send({ content: "Rain fell. Nobody survived." });
    expect(res.status).toBe(200);
    expect(res.body.wordCount).toBe(4);

    const main = await request(app).get(chapterPath()).set(asAlice());
    expect(main.body.content).toBe("Rain fell all night.");
    // Branch drafts are not part of the story yet
    expect(queued).toEqual([chapter.id]);
  });

  it("starts a branch from an older version", async () => {
    const saved = await request(app).post(`${chapterPath()}/versions`).set(asAlice()).send({});
    await saveText("Completely rewritten.");

    const branch = await createBranch("Original idea", { fromVersionId: saved.body.id });
    expect(branch.content).toBe("Rain fell all night.");
  });

  it("lists branches and rejects a duplicate name", async () => {
    await createBranch("A");
    await createBranch("B");

    const list = await request(app).get(`${chapterPath()}/branches`).set(asAlice()).expect(200);
    expect(
      branchSummarySchema
        .array()
        .parse(list.body)
        .map((b) => b.name),
    ).toEqual(["A", "B"]);

    const duplicate = await request(app)
      .post(`${chapterPath()}/branches`)
      .set(asAlice())
      .send({ name: "A" });
    expect(duplicate.status).toBe(409);
  });

  it("validates branch input", async () => {
    const res = await request(app)
      .post(`${chapterPath()}/branches`)
      .set(asAlice())
      .send({ name: "   " });
    expect(res.status).toBe(400);
  });

  it("keeps a branch: it replaces the main text, and the old text and branch history are saved", async () => {
    const branch = await createBranch();
    const branchPath = `${chapterPath()}/branches/${branch.id}`;
    await request(app).patch(branchPath).set(asAlice()).send({ content: "Version B, first try." });
    await request(app).post(`${chapterPath()}/versions`).set(asAlice()).send({
      branchId: branch.id,
      label: "Branch checkpoint",
    });
    await request(app).patch(branchPath).set(asAlice()).send({ content: "Version B, final." });
    queued.length = 0;

    const res = await request(app).post(`${branchPath}/keep`).set(asAlice());

    expect(res.status).toBe(200);
    expect(chapterSchema.parse(res.body).content).toBe("Version B, final.");
    expect(queued).toEqual([chapter.id]);
    expect((await request(app).get(branchPath).set(asAlice())).status).toBe(404);

    const versions = await listVersions();
    expect(versions.map((v) => [v.reason, v.label])).toEqual([
      ["before_keep", 'Before keeping "Darker ending"'],
      ["manual", "Branch checkpoint"],
      // The branch's starting text, saved by its first edit
      ["autosave", ""],
    ]);
    const old = await request(app)
      .get(`${chapterPath()}/versions/${versions[0]!.id}`)
      .set(asAlice());
    expect(old.body.content).toBe("Rain fell all night.");
  });

  it("restores a branch version into the branch, not the main text", async () => {
    const branch = await createBranch();
    const saved = await request(app)
      .post(`${chapterPath()}/versions`)
      .set(asAlice())
      .send({ branchId: branch.id });
    expect(saved.status).toBe(201);
    await request(app)
      .patch(`${chapterPath()}/branches/${branch.id}`)
      .set(asAlice())
      .send({ content: "Changed in the branch." });
    queued.length = 0;

    const res = await request(app)
      .post(`${chapterPath()}/versions/${saved.body.id}/restore`)
      .set(asAlice());

    const result = restoreResultSchema.parse(res.body);
    expect(result).toMatchObject({ target: "branch", branch: { content: "Rain fell all night." } });
    expect(queued).toEqual([]);
    expect(await listVersions(branch.id)).toHaveLength(2);
  });

  it("discards a branch", async () => {
    const branch = await createBranch();
    await request(app).delete(`${chapterPath()}/branches/${branch.id}`).set(asAlice()).expect(204);
    expect(await prisma.chapterBranch.count()).toBe(0);
  });

  it("hides another user's branches", async () => {
    const branch = await createBranch();
    const branchPath = `${chapterPath()}/branches/${branch.id}`;

    expect((await request(app).get(`${chapterPath()}/branches`).set(asBob())).status).toBe(404);
    expect(
      (await request(app).post(`${chapterPath()}/branches`).set(asBob()).send({ name: "x" }))
        .status,
    ).toBe(404);
    expect((await request(app).get(branchPath).set(asBob())).status).toBe(404);
    expect((await request(app).patch(branchPath).set(asBob()).send({ content: "x" })).status).toBe(
      404,
    );
    expect((await request(app).post(`${branchPath}/keep`).set(asBob())).status).toBe(404);
    expect((await request(app).delete(branchPath).set(asBob())).status).toBe(404);
    expect(
      (
        await request(app)
          .get(`${chapterPath()}/versions`)
          .query({ branchId: branch.id })
          .set(asBob())
      ).status,
    ).toBe(404);
  });
});
