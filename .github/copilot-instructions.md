# Easy Law Agent Guide

- Monorepo managed by `pnpm` workspaces. Key apps: `projects/server-project` (Express API) and `projects/web-project` (Next.js 14 dashboard). Shared ESLint config lives in `packages/eslint-config`.
- Always run commands from the repo root unless noted; prefer PowerShell format. Example bootstrap:
  ```powershell
  Set-Location 'd:\Kingbora\ai-workspace\easy-law'
  pnpm install
  ```

## Server essentials
- Entry point `src/index.ts` runs `runMigrationsAndSeeds`, which executes Drizzle migrations (`drizzle/`) and seeds (`ensureDefaultPermissions`, `ensureDefaultCaseSettings`). Keep migrations in sync before touching data logic.
- Database access uses Drizzle ORM with schemas in `src/db/schema.ts`. Enums are materialized in Postgres; changing enum values requires a migration update.
- Authentication is handled by Better Auth (`src/auth/index.ts`). Routes obtain the session via `requireCurrentUser` in `routes/utils/current-user.ts` and gate actions with `ensureRoleAllowed`.
- REST routers live under `src/routes/*.ts`. `cases.ts` illustrates the validation pattern: sanitize input, enforce enum sets, and return structured response DTOs. Follow these helpers when adding fields.
- Error handling is centralized in `middlewares/error-handlers.ts`; throw `HttpError` with status/message for predictable responses.

## Server workflows
- Generate & push migrations:
  ```powershell
  pnpm --filter @easy-law/server-project db:generate
  pnpm --filter @easy-law/server-project db:push
  ```
- Seed the built-in super admin (email `super@qq.com`, password `a@000123`) via:
  ```powershell
  pnpm --filter @easy-law/server-project seed:super-admin
  ```
- Migration utilities:
  ```powershell
  pnpm --filter @easy-law/server-project exec tsx scripts/check-migrations.ts
  pnpm --filter @easy-law/server-project exec tsx scripts/reset-db.ts  # destructive: drops public & drizzle schemas
  ```
- `.env` (checked in for dev) exports `DATABASE_URL`, `HOST`, etc.; ensure Postgres is running before server scripts.

## Web essentials
- Next.js app resides in `projects/web-project/app`. Dashboard routes use the `(dashboard)` segment; e.g., `app/(dashboard)/cases/my/page.tsx` consumes the `/api/cases` endpoints.
- Shared UI components under `components/` (e.g., `components/cases/CaseModal.tsx`) mirror the server DTO shapes; align any schema changes with these components.

## Collaboration notes
- Husky + lint-staged enforce ESLint on commit; run `pnpm lint` locally before large changes.
- For risky DB operations (resets, seed overwrites) warn the user and confirm scope. Always restart the server after altering migrations or `.env`.
- When introducing new features, update both server routes and matching frontend components, and extend seeds if new reference data is required.
- Output in Chinese
