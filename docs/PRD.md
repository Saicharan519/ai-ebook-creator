# PRD: AI eBook Creator v2 (AI Writing Studio)

| | |
|---|---|
| **Owner** | Sai Charan |
| **Status** | Draft |
| **Last updated** | 2026-10-26 |
| **Replaces** | v1 (MERN, on `main`) |

---

## 1. Summary

An AI writing studio for long-form writing: novels, short-story collections, and structured notes. Writers plan, draft, and edit books chapter by chapter. An AI co-writer **remembers the whole story** (characters, places, events, earlier chapters), so its suggestions stay consistent from chapter 1 to chapter 40. Finished books can be exported as PDF, DOCX, or EPUB, or published to a public reader page.

## 2. Problem

General AI chat tools are bad at long-form writing:

1. **They forget.** A novel is far larger than what a model can read at once. By chapter 15, names drift, dead characters come back, and plot threads get dropped.
2. **Copy-paste workflow.** Writers bounce between a chat window and their document, re-explaining the story every time.
3. **No safety net.** Trying an alternate ending or a big rewrite risks losing the original draft.
4. **Formatting at the end is painful.** Getting from a draft to a clean PDF or EPUB takes separate tools.

## 3. Target users

| Persona | Needs |
|---|---|
| **Hobby novelist** (main persona) | Write a 20–50 chapter story; keep characters consistent; get unstuck |
| **Student or notes writer** | Turn scattered notes into a structured, readable book |
| **Short-story writer** | Many small stories in one collection; quick export and sharing |

## 4. Goals and non-goals

### Goals
- G1: A writer can go from an idea to an outline, drafted chapters, and an exported book in one place.
- G2: AI suggestions stay consistent with what the story has already established.
- G3: No work is ever lost (autosave and version history).
- G4: The codebase is production quality: typed, tested, secure, and documented.

### Non-goals (v2)
- Mobile apps
- Payments or subscriptions
- Image generation for covers or illustrations
- Multi-language UI
- Real-time co-authoring (stretch goal only, see §7)

## 5. User stories

**Writing**
- As a writer, I can create a book with a title, genre, premise, and writing style.
- As a writer, I can generate an outline from a premise, then edit, reorder, add, or delete chapters.
- As a writer, I can write in a rich editor that autosaves.

**AI co-writer**
- As a writer, I can select text and ask the AI to **Continue, Rewrite, Expand, Shorten, Change tone, or Show-don't-tell**, and see the result stream in.
- As a writer, I can accept, reject, or retry any AI suggestion before it touches my text.
- As a writer, I can generate a full chapter draft from its outline entry.

**Story Memory**
- As a writer, I can see a **Story Bible** of characters, places, items, and key events that the app extracted from my chapters automatically.
- As a writer, I can edit or pin Story Bible entries, for example "Arjun is left-handed".
- As a writer, AI output respects the Story Bible and earlier chapters.
- As a writer, I get **consistency warnings** when a chapter contradicts an established fact.

**Drafts**
- As a writer, I can see a chapter's version history and restore any version.
- As a writer, I can create a **"what-if" branch** of a chapter, try a different direction, and later keep either version.

**Publishing**
- As a writer, I can export a book as PDF, DOCX, or EPUB with a cover and table of contents.
- As a writer, I can publish a book to a public read-only link and unpublish it later.

**Account**
- As a user, I can sign up, log in, stay logged in securely, and log out of all devices.

## 6. Features and priority

| # | Feature | Priority |
|---|---|---|
| F1 | Auth (email + password, refresh tokens) | P0 |
| F2 | Books and chapters CRUD, drag-and-drop reorder | P0 |
| F3 | Rich editor with autosave | P0 |
| F4 | AI outline + chapter draft generation | P0 |
| F5 | Inline AI actions with streaming | P0 |
| F6 | Export: PDF, DOCX | P0 |
| F7 | **Story Memory**: extraction, Story Bible, AI context assembly | P0 (signature feature) |
| F8 | Consistency checker | P1 |
| F9 | Version history + restore | P1 |
| F10 | What-if branches | P1 |
| F11 | EPUB export + table of contents | P1 |
| F12 | Public reader page | P1 |
| F13 | AI usage quota per user | P1 |
| F14 | Real-time co-authoring (Yjs + WebSockets) | P2 (stretch) |

## 7. Feature details

### F5: Inline AI actions
- The request carries the action, the selected text, and the chapter ID. The server assembles context (§8) and streams tokens back over **Server-Sent Events**.
- The suggestion is shown as a separate block with Accept / Reject / Retry. Nothing is written into the chapter until the user accepts.
- The user can cancel a request in progress. Cancelling aborts the upstream LLM call.

### F7: Story Memory
- **Trigger:** when a chapter is saved and its content changed meaningfully (more than ~200 characters since the last extraction), queue a background job, debounced per chapter.
- **The job:**
  1. Split the chapter into chunks of about 300–500 tokens, embed them, and store the embeddings in pgvector.
  2. Generate a short chapter summary of about 150 words.
  3. Extract entities (character, place, item, event) and **facts** (entity, attribute, value, source chapter) as structured JSON. Validate the output with Zod and merge it into the Story Bible.
- **Story Bible UI:** a side panel listing entities, their facts, and where each one appears. User edits and pins always win over extracted data.

### F8: Consistency checker
- After extraction, compare new facts against existing facts with the same entity and attribute but a different value.
- Candidate conflicts go through one LLM check to filter out false positives (for example, a character changes their hair on purpose).
- Confirmed conflicts appear as warnings linked to both chapters. The user can dismiss them or fix the text.

### F9/F10: Versions and branches
- A version snapshot is created on manual save, before any AI change is accepted, and at most every 10 minutes during autosave.
- A branch is a named line of versions from a parent version. "Keep this branch" makes it the main content.

## 8. AI design: building the context

Every AI call gets a **context package** built within a fixed token budget (default about 12k input tokens), filled in this priority order:

1. **System prompt:** role, output rules, and the book's style guide (genre, POV, tense, tone).
2. **Book premise** and the outline entry for the current chapter.
3. **Pinned Story Bible entries**, plus entries for entities mentioned in the current chapter or selection.
4. **Rolling summaries** of earlier chapters (most recent first, trimmed to fit).
5. **Retrieved passages:** the top-k chunks from earlier chapters, found by vector similarity to the current text.
6. **Local text:** the last ~1,500 tokens before the cursor or selection.

Rules:
- All structured LLM output (outline, extraction) is validated with Zod and retried once on failure.
- User text is passed as clearly separated data, never mixed into instructions.
- The LLM provider sits behind an interface (`LlmProvider`). Gemini is the default, and it can be swapped later.

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| Security | Input validation on every route (Zod); ownership checks on every book-scoped query; bcrypt password hashing; short-lived access token in memory and refresh token in an httpOnly, SameSite cookie; refresh-token rotation; rate limiting (auth and AI routes); CORS allow-list; escaped or sanitized rendering of user content; secrets only in env vars |
| Performance | First AI token appears in under 2 s (p50); CRUD API responds in under 200 ms (p95) locally; editor stays responsive with 10k+ word chapters |
| Reliability | Background jobs retry with backoff; a failed extraction never blocks saving; autosave never loses more than 5 s of typing |
| Cost | Per-user daily AI quota; usage logged per call (tokens in and out) |
| Quality | TypeScript strict mode; lint and tests run in CI on every push; at least 60% test coverage on the API |
| Accessibility | Keyboard-accessible editor actions; WCAG AA color contrast |

## 10. Data model (overview)

```
User ──< Session (refresh tokens)
User ──< Book ──< Chapter ──< ChapterVersion (parentVersionId, branchName)
                 │        ──< Chunk (text, embedding vector)
                 ──< Entity ──< Fact (attribute, value, sourceChapterId, pinned)
                 │          ──< Mention (chapterId, excerpt)
                 ──< ConsistencyWarning (factA, factB, status)
User ──< AiUsage (kind, tokensIn, tokensOut, createdAt)
```

## 11. Tech stack and hosting

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | Type safety; most SDE job descriptions ask for it |
| Monorepo | npm workspaces: `apps/api`, `apps/web`, `packages/shared` | Shared Zod schemas and types between frontend and backend |
| API | Node 22+, Express 5 | Same framework as v1, so backend skills show directly |
| Database | PostgreSQL + Prisma + **pgvector** | Relational data plus vector search in one database |
| Background jobs | **pg-boss** (job queue stored in Postgres) | Retries, scheduling, and debouncing with no extra Redis service to host |
| Frontend | React 19, Vite, React Router, TanStack Query, Tailwind | Proper data fetching and caching |
| Editor | TipTap (ProseMirror), stored as Markdown | Selection-based AI actions, and Yjs collaboration later |
| AI | Google Gemini (text + embeddings) behind `LlmProvider` | Free tier; swappable |
| Export | pdfkit, docx, EPUB generator, markdown-it | Reuses the v1 export pipeline |
| Testing | Vitest + Supertest (API), Vitest + Testing Library (web), Playwright (one end-to-end happy path) | |
| Local dev | **Docker Compose: Postgres + pgvector only** | One command to start the database; no cloud account needed |
| Hosting | Vercel (web), Render (API, native Node, not Docker), Neon (Postgres with pgvector, free tier) | All free tier |

## 12. Success metrics (for a portfolio project)

- A new user goes from signup to an exported 3-chapter book in under 10 minutes.
- On a 20-chapter test story with planted contradictions, the consistency checker finds at least 70% of them.
- CI is green, with 40+ API tests and one end-to-end test.
- The README has a demo GIF, an architecture diagram, and a live link.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Gemini free-tier rate limits | Per-user quota, queueing, exponential backoff, cache summaries |
| Extraction quality varies | Zod validation, user edits always win, pinned facts |
| Render free tier sleeps (cold starts) | Show "waking server" in the UI; jobs resume via pg-boss |
| Scope creep | Ship P0 end to end before starting P1; F14 only if time allows |

## 14. Open questions

- Product name: keep "AI eBook Creator" or rebrand?
- Store chapter content as Markdown only, or also as TipTap JSON? (Current plan: Markdown is the source of truth.)
- Email verification and password reset now, or later?
