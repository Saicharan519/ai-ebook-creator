# CLAUDE.md

Guidance for AI coding assistants working in this repository.

## Project

AI eBook Creator: an AI writing studio for novels, stories, and notes. Its signature feature is **Story Memory**: the AI keeps track of characters, places, and events across chapters, so long books stay consistent.

- Requirements: [docs/PRD.md](docs/PRD.md)
- Build plan and progress checklist: [docs/PLAN.md](docs/PLAN.md)

## Current state

- `main` holds **v1** (MERN, JavaScript): `backend/` (Express + MongoDB) and `frontend/ebook/` (React + Vite). Legacy code; only bug fixes go here.
- **v2** is being built on the `v2` branch as a TypeScript monorepo (see the structure below). Check `docs/PLAN.md` for which phase is in progress before starting work.

## v2 structure

```
apps/api/          Express 5 + TypeScript REST API
  src/modules/     One folder per feature: auth, books, chapters, ai, memory, export
                   Each has: *.routes.ts, *.controller.ts, *.service.ts, *.schema.ts, *.test.ts
  src/lib/         db (Prisma), llm (LlmProvider), jobs (pg-boss), env, errors
  prisma/          schema.prisma + migrations
apps/web/          React 19 + Vite + TypeScript
  src/features/    Feature folders mirroring the API modules
  src/lib/         API client, auth, query client
packages/shared/   Zod schemas + types shared by api and web
docs/              PRD, plan, architecture notes
```

## Commands (v2)

```bash
docker compose up -d          # start Postgres + pgvector
npm install                   # install all workspaces
npm run dev                   # api + web in watch mode
npm run test                  # all tests
npm run lint && npm run typecheck
npm run db:migrate            # prisma migrate dev
```

## Conventions

- **TypeScript strict.** No `any` unless there's a comment saying why.
- **Validate every request** with a Zod schema from `packages/shared`. Never pass `req.body` straight to the database.
- **Scope every book-related query to the owner** (`where: { id, ownerId: user.id }`). Every route gets a test showing that another user gets a 404.
- Controllers stay thin: parse the input, call the service, send the response. Business logic lives in services.
- Throw `AppError` subclasses (for example `NotFoundError`). The central error handler formats every error response.
- Every LLM call goes through `LlmProvider` and the context builder. Structured LLM output is validated with Zod. Tests use the fake provider, never the real API.
- User-written text and AI output are **escaped or sanitized** before being rendered as HTML.
- Names: `camelCase` for variables and functions, `PascalCase` for components and types, `kebab-case` for files outside components. Spell names correctly (no `chepters`, `halper`).
- Comments explain *why*, not what. No leftover debug logs or "fixed bug X" comments.

## Git

- Commit messages: imperative summary line under 72 characters, with an optional body.
- **Never add AI attribution** (no `Co-Authored-By: Claude` or similar) to commits or PRs.
- Never commit `.env` files, uploads, or secrets. Update `.env.example` when adding a variable.
- Before committing: lint, typecheck, and tests all pass.

## Do not

- Do not change the database schema without creating a Prisma migration.
- Do not add a new dependency when an existing one already covers the need.
- Do not touch the v1 code (`backend/`, `frontend/`) when working on v2.
