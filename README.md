# Easy Law Monorepo

This repository is a pnpm-powered monorepo that hosts the Easy Law projects and shared tooling.

## Structure

- `projects/server-project` – TypeScript + Express authentication service powered by Better Auth.
- `projects/web-project` – Next.js 14 login experience styled with Ant Design and SCSS modules.
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

## Authentication Only

The server now 仅提供 `/api/auth` 相关登录鉴权接口，前端只保留登录页面。

## Database
```powershell
# 开发环境开始开发，更改本地数据库
pnpm db:push
# 通过以下生成文件，便于CI/CD进行迁移
pnpm db:generate
# CI/CD中运行
pnpm db:migrate
```
## Data logs
```bash
# 查看前后端启动log
docker logs app-3000-4000

# 查看nginx错误日志
tail -f /var/log/nginx/error.log
```
