/**
 * Captures the README screenshots and demo GIF from a running app.
 *
 *   npm run dev                                  # in another terminal
 *   npm run screenshots -w @ebook/e2e
 *
 * Creates a demo account and a short novel with one planted contradiction,
 * waits for Story Memory to read it (with AI_PROVIDER=gemini this makes a few
 * calls on the memory model), then photographs each part of the app into
 * docs/screenshots/. The GIF needs ffmpeg on the PATH.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type Page } from "@playwright/test";

const WEB = process.env.WEB_URL ?? "http://localhost:5173";
const API = process.env.API_URL ?? "http://localhost:8000";
const OUT = resolve(import.meta.dirname, "../../docs/screenshots");
const VIEWPORT = { width: 1440, height: 900 };

const CHAPTERS = [
  {
    title: "Salt and Cinder",
    content: `The lamp at Eilean Dubh had been dark for eleven years when Elspeth Gunn climbed the iron stairs with a tin of oil and her father's key.

She was nineteen, grey-eyed like her mother, and stubborn in a way the island had stopped commenting on. From the gallery she could see the whole north cliff, the jetty, and the *Kittiwake* rocking on her mooring.

"You'll not get it lit," said Tam Moffat from the doorway below. "The mechanism's seized."

"Then I'll unseize it," Elspeth said, and set the tin down beside the lens.`,
  },
  {
    title: "The Keeper's Ledger",
    content: `The ledger was in the drawer where her father had left it, its last entry dated the night of the storm: *Lamp lit 18:40. Wind NW, rising. Boat seen off the Skerries.*

Elspeth read it twice. Nobody had ever told her about a boat.

Tam would not meet her eye when she asked. He mended nets on the jetty and talked about the weather, and the price of diesel, and anything at all except the night the light went out.

## The second hand

On the inside cover, in writing that was not her father's, someone had added a single line: *They came for the lamp, not for him.*`,
  },
  {
    title: "Echoes",
    content: `By the third week the brass gears turned again, stiffly, like an old man rising from a chair.

Elspeth stood back to watch the first slow sweep of the beam across the water. Her brown eyes stung from the paraffin smoke, and she laughed out loud, alone in the lantern room, because it was working.

Down on the jetty, Tam had stopped mending. He was looking out to sea, toward the Skerries, where for one moment the beam caught something pale on the water and let it go.

---

That night the radio in the kitchen crackled with a voice she did not know, asking for the keeper by name.`,
  },
  {
    title: "The Boat Off the Skerries",
    content: `The *Kittiwake* was older than Elspeth and smelled of tar and her father's pipe. She took it out at first light, with the ledger wrapped in oilcloth under the seat.

The Skerries were three black teeth of rock a mile north of the island. Gulls lifted from them as she came close, and in the lee of the largest she found what the beam had touched: a wooden hull, overturned and green with weed, its name still legible on the stern.

She did not need to read it twice. It was the name from the ledger.`,
  },
];

async function api<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...rest } = init;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "fetch",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  if (!res.ok)
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status}: ${await res.text()}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

interface Book {
  id: string;
  slug: string | null;
  chapters: { id: string }[];
}

async function seed() {
  const email = `demo-${Date.now()}@example.test`;
  const password = randomUUID();
  const { accessToken: token } = await api<{ accessToken: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: "Morag Lennox", email, password }),
  });

  const book = await api<Book>("/books", {
    method: "POST",
    token,
    body: JSON.stringify({
      title: "The Lighthouse Keeper's Daughter",
      author: "Morag Lennox",
      genre: "Literary mystery",
      premise:
        "Eleven years after her father vanished, a young woman relights the lighthouse on a remote Scottish island and finds his last ledger.",
      writingStyle: "Spare, atmospheric third person",
    }),
  });

  const chapterIds = [book.chapters[0]!.id];
  for (let i = 1; i < CHAPTERS.length; i++) {
    const created = await api<{ id: string }>(`/books/${book.id}/chapters`, {
      method: "POST",
      token,
      body: JSON.stringify({ title: CHAPTERS[i]!.title }),
    });
    chapterIds.push(created.id);
  }
  for (const [i, chapter] of CHAPTERS.entries()) {
    await api(`/books/${book.id}/chapters/${chapterIds[i]}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(chapter),
    });
  }

  // A saved version and a later edit, so History has something to compare
  const first = `/books/${book.id}/chapters/${chapterIds[0]}`;
  await api(`${first}/versions`, {
    method: "POST",
    token,
    body: JSON.stringify({ label: "First draft" }),
  });
  await api(first, {
    method: "PATCH",
    token,
    body: JSON.stringify({
      content: CHAPTERS[0]!.content.replace(
        "and stubborn in a way the island had stopped commenting on",
        "and stubborn in a way the whole island had long since given up arguing with",
      ),
    }),
  });

  // A second book so the dashboard isn't a single card
  await api("/books", {
    method: "POST",
    token,
    body: JSON.stringify({
      title: "Notes from the North Road",
      author: "Morag Lennox",
      genre: "Essays",
    }),
  });

  const published = await api<Book>(`/books/${book.id}/publish`, { method: "POST", token });
  return { email, password, token, book: published, chapterIds };
}

interface StoryBible {
  status: { enabled: boolean; pendingChapters: number };
  warnings: unknown[];
  entities: unknown[];
}

async function waitForStoryMemory(token: string, bookId: string) {
  const deadline = Date.now() + 4 * 60_000;
  while (Date.now() < deadline) {
    const bible = await api<StoryBible>(`/books/${bookId}/story-bible`, { token });
    if (!bible.status.enabled) {
      console.log("Story Memory is off (no AI provider); the Story Bible shot will be empty.");
      return;
    }
    console.log(
      `Story Memory: ${bible.status.pendingChapters} chapters pending, ${bible.entities.length} entries, ${bible.warnings.length} warnings`,
    );
    if (bible.status.pendingChapters === 0 && bible.entities.length > 0) return;
    await new Promise((r) => setTimeout(r, 10_000));
  }
  console.log("Story Memory didn't finish in time; continuing anyway.");
}

const settle = (page: Page, ms = 1500) => page.waitForTimeout(ms);

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { email, password, token, book, chapterIds } = await seed();
  console.log(`Seeded "${book.slug}"`);
  await waitForStoryMemory(token, book.id);

  const browser = await chromium.launch();
  const videoDir = join(OUT, ".video");
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: "light",
    recordVideo: { dir: videoDir, size: VIEWPORT },
  });
  const page = await context.newPage();
  const shot = (name: string) => page.screenshot({ path: join(OUT, `${name}.png`) });

  // Landing: let the hero finish typing
  await page.goto(WEB);
  await settle(page, 6000);
  await shot("landing");

  await page.goto(`${WEB}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("heading", { name: "Your books" }).waitFor();
  await settle(page);
  await shot("dashboard");

  // Editor on the chapter with the contradiction, Story Bible open
  await page.goto(`${WEB}/books/${book.id}?chapter=${chapterIds[2]}`);
  await page.locator(".chapter-prose").first().waitFor();
  await settle(page);
  await shot("editor");
  await page.getByRole("button", { name: "Story Bible" }).click();
  await settle(page, 2500);
  await shot("story-bible");

  // History on the first chapter, comparing against the saved draft
  await page.goto(`${WEB}/books/${book.id}?chapter=${chapterIds[0]}`);
  await page.locator(".chapter-prose").first().waitFor();
  await page.getByRole("button", { name: "History" }).click();
  await page.getByRole("button", { name: /First draft/ }).click();
  await settle(page);
  await shot("history");

  // The public reader, as anyone with the link sees it
  await page.goto(`${WEB}/read/${book.slug}`);
  await settle(page);
  await shot("reader");
  await page.goto(`${WEB}/read/${book.slug}/${chapterIds[0]}`);
  await settle(page);

  await context.close();
  await browser.close();

  const video = readdirSync(videoDir).find((file) => file.endsWith(".webm"));
  if (video) {
    try {
      const input = join(videoDir, video);
      const filters = "fps=10,scale=960:-1:flags=lanczos";
      execFileSync("ffmpeg", [
        "-y",
        "-loglevel",
        "error",
        "-i",
        input,
        "-vf",
        `${filters},split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
        join(OUT, "demo.gif"),
      ]);
      console.log("Wrote demo.gif");
    } catch (error) {
      console.log("Couldn't make the GIF (is ffmpeg installed?)", error);
    }
  }
  rmSync(videoDir, { recursive: true, force: true });
  console.log(`Screenshots saved to ${OUT}`);
}

await main();
