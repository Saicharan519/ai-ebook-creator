import { beforeEach, describe, expect, it } from "vitest";
import { DatabaseStorage } from "../src/lib/storage";
import { makePng } from "./fixtures";
import { resetDatabase } from "./helpers";

describe("DatabaseStorage", () => {
  const storage = new DatabaseStorage("https://api.example.com/uploads");

  beforeEach(resetDatabase);

  it("saves, reads, replaces, and deletes files", async () => {
    const key = "covers/0190a0b0-0000-7000-8000-000000000001.png";
    const first = makePng(2, 3);
    const second = makePng(4, 5);

    expect(await storage.read(key)).toBeNull();
    await storage.save(key, first);
    expect((await storage.read(key))?.equals(first)).toBe(true);

    await storage.save(key, second);
    expect((await storage.read(key))?.equals(second)).toBe(true);

    await storage.delete(key);
    expect(await storage.read(key)).toBeNull();
    // Deleting something that isn't there is fine
    await storage.delete(key);
  });

  it("builds public URLs from the key", () => {
    expect(storage.publicUrl("covers/a.png")).toBe("https://api.example.com/uploads/covers/a.png");
  });
});
