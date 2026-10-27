# Build Plan: AI eBook Creator v2

Requirements are in [PRD.md](PRD.md). The work happens on the **`v2` branch**. `main` keeps v1 until v2 matches its features, then v2 is merged in.

**Rule:** each phase ends with something working, tested, and committed. Don't start the next phase with the current one half done.

Rough time: **5–7 weeks** at about 3–4 hours a day.

---

## Phase 0: Foundation (2–3 days) ✅ Done

**Goal:** an empty but working monorepo. `npm run dev` starts the API and the web app, and CI passes.

- [x] Create the `v2` branch. Move v1 code into `legacy/` for reference (deleted at the end).
- [x] Set up the npm workspaces monorepo:
  ```
  apps/api        Express 5 + TypeScript
  apps/web        React 19 + Vite + TypeScript
  packages/shared Zod schemas + shared types
  ```
- [x] Shared `tsconfig` (strict), ESLint, and Prettier
- [x] `docker-compose.yml` with **Postgres 16 + pgvector** only
- [x] Prisma set up with a first migration (`User`)
- [x] Env validation with Zod: the app refuses to start if a variable is missing or wrong
- [x] API skeleton: `/health`, a central error handler, request logging (pino), CORS allow-list, helmet
- [x] Web skeleton: router, TanStack Query, Tailwind, and an API client
- [x] Vitest in both apps, plus one passing test each
- [x] GitHub Actions: install → lint → typecheck → test (with a Postgres service)

**Done when:** a fresh clone followed by `docker compose up -d && npm install && npm run dev` works, and CI passes.

---

## Phase 1: Core app (1–1.5 weeks) ✅ Done

**Goal:** what v1 does today, rebuilt properly.

**Auth**
- [x] Register and login (bcrypt). Access token (15 min) returned in JSON; refresh token in an httpOnly cookie.
- [x] `POST /auth/refresh` with token rotation and reuse detection; `POST /auth/logout`; log out of all devices
- [x] Rate-limit the auth routes
- [x] Web: auth context, silent refresh on 401, protected routes

**Books and chapters**
- [x] Prisma models: `Book`, `Chapter` (with `position`)
- [x] REST: books CRUD, chapters CRUD, `PATCH /books/:id/chapters/order`
- [x] Every query is scoped to the logged-in user. Tests check that user A can't access user B's books.
- [x] Cover upload (local disk in dev, behind a `Storage` interface)

**Editor**
- [x] Dashboard with book cards; create-book flow (title, genre, premise, style)
- [x] Editor page: chapter sidebar with dnd-kit reorder, and a TipTap editor that saves Markdown
- [x] Debounced autosave with a "Saving… / Saved" indicator

**Export**
- [x] Port the v1 markdown → PDF/DOCX export to TypeScript, with tests that build a sample book and check the output

**Done when:** you can sign up, create a book, write chapters, reorder them, and export PDF/DOCX. There are 25+ API tests.

---

## Phase 2: AI co-writer (1 week) ✅ Done

**Goal:** the AI writes with you, streaming in real time.

- [x] `LlmProvider` interface + Gemini implementation (generate, stream, embed)
- [x] `POST /ai/outline`: premise → chapters, validated with Zod, retried once on bad JSON
- [x] `POST /ai/chapter-draft` (streamed)
- [x] `POST /ai/inline` (streamed over SSE) with actions: continue, rewrite, expand, shorten, tone, show-don't-tell
- [x] Cancellation: client abort → server aborts the Gemini request
- [x] Web: selection toolbar in the editor, a suggestion block with Accept / Reject / Retry, and a stop button
- [x] `AiUsage` logging + per-user daily quota + rate limit on AI routes
- [x] Tests with a fake `LlmProvider` (no real API calls in CI)

**Done when:** selecting a paragraph and clicking "Rewrite" streams a suggestion you can accept or reject.

---

## Phase 3: Story Memory (1.5–2 weeks), the signature feature ✅ Done

**Goal:** the AI remembers the story.

- [x] pg-boss set up; `extract-chapter` job queued on save, debounced per chapter
- [x] Chunking + embeddings → `Chunk` table (pgvector)
- [x] Chapter summary job → `Chapter.summary`
- [x] Entity and fact extraction (structured JSON + Zod) → `Entity`, `Fact`, `Mention`, with a merge step that matches the same character under different names
- [x] **Context builder**: assembles the AI context within a token budget, in the priority order from PRD §8. Unit-tested thoroughly, since this is the core logic.
- [x] Hook the context builder into chapter drafts and inline actions (outlines plan new books, so they don't need it)
- [x] Web: Story Bible side panel (list, edit, pin entities and facts; jump to mentions)
- [x] **Consistency checker** (F8): candidate conflicts → LLM check → `ConsistencyWarning` → shown in the UI
- [x] Evaluation script: an 8-chapter story with 7 planted contradictions and 4 explained changes, run 3 times; results in [docs/eval/story-memory.md](eval/story-memory.md)

**Done when:** a character introduced in chapter 2 is described correctly when the AI continues chapter 12, and a planted contradiction gets flagged.

---

## Phase 4: Versions, branches, and publishing (1 week) ✅ Done

- [x] `ChapterVersion` snapshots (manual save or Ctrl+S, before accepting AI changes, before a restore or kept branch, at most every 10 minutes during autosave; old autosaves pruned)
- [x] History panel: list versions, view a word diff against the current text, restore (the current text is saved first)
- [x] What-if branches: create (from the main text or any version), switch, keep (replaces the main text; its history moves over) or discard. Story Memory only reads the main text.
- [x] EPUB export + table of contents in all export formats (PDF: page numbers, links, sidebar outline; Word: linked contents page)
- [x] Public reader: `slug`, publish/unpublish, a read-only page that needs no login

---

## Phase 5: Ship (3–4 days)

- [ ] Playwright end-to-end test: signup → create book → AI outline → write → export
- [ ] Deploy: Neon (Postgres + pgvector), Render (API), Vercel (web, with an SPA rewrite so `/read/*` links load); move covers to Cloudinary
- [ ] README: demo GIF, architecture diagram, Story Memory explanation, eval results, live link
- [ ] Delete `legacy/` and merge `v2` into `main`

---

## Stretch: real-time co-authoring (F14)

Only after Phase 5 is complete. Yjs + y-websocket, TipTap collaboration extension, presence cursors, and sharing a book with another user by email.

---

## How we work

- One feature per commit (or small group of commits), with clear messages and **no AI attribution lines**.
- Every API route gets a test that covers the success case, a validation failure, and access by another user.
- Update this checklist as tasks are finished.
