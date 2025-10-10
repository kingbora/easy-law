# Easy Law Monorepo

This repository is a pnpm-powered monorepo that hosts the Easy Law projects and shared tooling.

## Structure

- `projects/server-project` – TypeScript + Express service with CORS, graceful error handling, and a `/health` endpoint.
- `projects/web-project` – Next.js 14 application styled with Ant Design and SCSS modules.
- `packages/eslint-config` – Shared ESLint configuration consumed by all packages.

## Getting Started

```powershell
pnpm install
```

### Useful Scripts

```powershell
pnpm --filter @easy-law/server-project run dev   # run Express API in watch mode
pnpm --filter @easy-law/web-project run dev      # start Next.js dev server
pnpm lint                                       # run lint across the workspace
```

### Git Hooks

Husky + lint-staged automatically run ESLint on staged files before each commit.

## Health Check

After starting the server project, verify the health endpoint:

```powershell
Invoke-RestMethod -Uri http://localhost:4000/health
```

It should respond with:

```json
{
  "status": "ok",
  "timestamp": "..."
}
```
