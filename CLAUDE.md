# CLAUDE.md

Guidance for AI coding assistants working in this repository.

## Project

AI eBook Creator: an AI writing studio for novels, stories, and notes. Its signature feature is **Story Memory**: the AI keeps track of characters, places, and events across chapters, so long books stay consistent.

- Requirements: [docs/PRD.md](docs/PRD.md)
- Build plan and progress checklist: [docs/PLAN.md](docs/PLAN.md)

## Current state

- `main` holds **v1** (MERN, JavaScript). Only bug fixes go there.
- **v2** is being built on the `v2` branch. On that branch the v1 code lives in `legacy/` for reference only. Check `docs/PLAN.md` for which phase is in progress before starting work.

## v2 structure

```
apps/api/          Express 5 + TypeScript REST API
  src/modules/     One folder per feature: health, auth, books, chapters, ai, memory, export
                   Each has: *.routes.ts, *.controller.ts, *.service.ts as needed
  src/lib/         env (Zod-validated), db (Prisma), logger (pino), errors (AppError)
  src/middleware/  error handler, requireAuth
                   Book routes (books, chapters, export) are mounted together at /books behind requireAuth
  src/generated/   Prisma client (generated, gitignored; never edit)
  prisma/          schema.prisma + migrations (config in prisma.config.ts, Prisma 7)
  test/            API tests (Vitest + Supertest) against a real test database
apps/web/          React 19 + Vite + TypeScript + Tailwind 4
  src/features/    Feature folders; component tests sit next to the component
  src/lib/         API client (apiRequest), query client
  src/pages/       Route-level components; routes are in src/router.tsx
packages/shared/   Zod schemas + types shared by api and web (shipped as TS source)
legacy/            v1 code, reference only
docs/              PRD, plan
```

## Commands (v2)

```bash
docker compose up -d          # Postgres 17 + pgvector on localhost:5433 (5432 is taken locally)
npm install                   # all workspaces; postinstall runs prisma generate
npm run dev                   # api (:8000) + web (:5173) in watch mode
npm test                      # all tests; API tests use the ebook_test database (apps/api/.env.test)
npm run lint && npm run typecheck && npm run format:check
npm run build
npm run db:migrate -- --name x # create + apply a migration, then regenerate the client
```

CI (`.github/workflows/ci.yml`) runs format check, lint, typecheck, tests, and build on every push.

## Conventions

- **TypeScript strict.** No `any` unless there's a comment saying why.
- **Validate every request** with a Zod schema from `packages/shared`. Never pass `req.body` straight to the database.
- **Scope every book-related query to the owner** (`where: { id, ownerId: user.id }`). Every route gets a test showing that another user gets a 404.
- Controllers stay thin: parse the input, call the service, send the response. Business logic lives in services.
- Throw `AppError` subclasses (for example `NotFoundError`). The central error handler formats every error response.
- Every LLM call goes through `LlmProvider` (`apps/api/src/lib/llm`) and the prompt builders in `modules/ai/prompts.ts`; author text always goes inside `tag()` blocks. Structured LLM output is validated with Zod. Tests inject `FakeLlmProvider` via `createApp({ llm })`, never the real API.
- Streamed AI responses use Server-Sent Events (`modules/ai/sse.ts` on the API, `lib/sse.ts` + `features/ai` on the web). Every AI call records token usage for the daily quota.
- User-written text and AI output are **escaped or sanitized** before being rendered as HTML.
- Names: `camelCase` for variables and functions, `PascalCase` for components and types, `kebab-case` for files outside components. Spell names correctly (no `chepters`, `halper`).
- Comments explain *why*, not what. No leftover debug logs or "fixed bug X" comments.

## Git

- Commit messages: imperative summary line under 72 characters, with an optional body.
- **Never add AI attribution** (no `Co-Authored-By: Claude` or similar) to commits or PRs.
- Never commit `.env` files, uploads, or secrets. Update `.env.example` when adding a variable.
- Before committing: lint, typecheck, and tests all pass.

## Story Memory (`apps/api/src/modules/memory`)

- `pipeline.ts` processes one chapter (chunks + embeddings, extraction, merge, consistency). It is idempotent by content hash; pass `{ force: true }` to re-read.
- Jobs run through `MemoryQueue` (pg-boss in `server.ts`, a recording fake in tests). Routes call `memoryQueue.enqueueChapter` and must never fail a save because of the queue.
- Embeddings live in `chunks.embedding` (`vector(768)`), written and searched with raw SQL.
- Background tasks (`task: "memory" | "consistency"`) run on `GEMINI_MEMORY_MODEL`; writing tasks on `GEMINI_MODEL`.
- Prompt or matching changes should be checked with `npm run eval:memory -w @ebook/api` (uses real tokens) and the report in `docs/eval/` updated.

## Do not

- Do not edit or delete a migration that has been applied; add a new one.

- Do not change the database schema without creating a Prisma migration.
- Do not add a new dependency when an existing one already covers the need.
- Do not touch the v1 code (`backend/`, `frontend/`) when working on v2.
