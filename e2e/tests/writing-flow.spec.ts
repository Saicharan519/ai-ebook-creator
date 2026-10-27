import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

/**
 * The main path through the app, as a new writer would take it:
 * sign up, create a book, plan it with AI, write, save a version, export,
 * and publish it to the public reader.
 */
test("a writer can go from sign-up to a published, exported book", async ({ page, browser }) => {
  const email = `e2e-${Date.now()}@example.test`;

  await test.step("sign up", async () => {
    await page.goto("/signup");
    await page.getByLabel("Name").fill("Edith Writer");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("correct horse battery staple");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Your books" })).toBeVisible();
  });

  await test.step("create a book", async () => {
    await page.getByRole("button", { name: "New book" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("The Salt Road");
    await dialog.getByLabel("Author").fill("Edith Writer");
    await dialog.getByLabel("Premise").fill("A courier crosses a drowned country.");
    await dialog.getByRole("button", { name: "Create book" }).click();
    await expect(page).toHaveURL(/\/books\/[0-9a-f-]+/);
    await expect(page.getByRole("button", { name: "The Salt Road" })).toBeVisible();
  });

  await test.step("plan chapters with AI", async () => {
    await page.getByRole("button", { name: "Plan chapters with AI" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Number of chapters").fill("3");
    await dialog.getByRole("button", { name: "Generate outline" }).click();
    await dialog.getByRole("button", { name: "Add 3 chapters" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: /^Move / })).toHaveCount(3);
  });

  await test.step("write, with help from the AI", async () => {
    const editor = page.locator(".chapter-prose[contenteditable='true']");
    await editor.click();
    await page.keyboard.type("Mara reached the ferry at dusk.");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Insert" }).click();
    await expect(editor).toContainText("The lantern swung in the wind");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  });

  await test.step("the text from before the AI change is in History", async () => {
    await page.getByRole("button", { name: "History" }).click();
    const history = page.getByRole("region", { name: "Version history" });
    await expect(history.getByText("Before an AI change")).toBeVisible();
    await history.getByRole("button", { name: "Close history" }).click();
  });

  await test.step("export as PDF and EPUB", async () => {
    for (const [label, signature] of [
      ["PDF", "%PDF-"],
      ["EPUB", "PK"],
    ] as const) {
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export" }).click();
      await page.getByRole("button", { name: new RegExp(`^${label}`) }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(`The Salt Road.${label.toLowerCase()}`);
      const file = await readFile((await download.path())!);
      expect(file.subarray(0, signature.length).toString("latin1")).toBe(signature);
    }
  });

  await test.step("publish and read it without logging in", async () => {
    await page.getByRole("button", { name: "Publish" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Publish" }).click();
    const link = await dialog.getByLabel("Public link").inputValue();
    expect(link).toMatch(/\/read\/the-salt-road-[a-z0-9]{8}$/);

    // A fresh browser context has no session cookie: a stranger with the link
    const stranger = await browser.newContext();
    const reader = await stranger.newPage();
    await reader.goto(link);
    await expect(reader.getByRole("heading", { level: 1, name: "The Salt Road" })).toBeVisible();
    await reader.getByRole("link", { name: "Start reading" }).click();
    await expect(reader.getByText("Mara reached the ferry at dusk.")).toBeVisible();
    await stranger.close();
  });
});
