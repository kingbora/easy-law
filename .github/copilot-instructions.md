# 🚀 Copilot 项目开发指南

## 📖 项目概述

**项目名称**: 法律案件管理系统
**项目类型**: 前后端分离应用
**系统角色**: 超级管理员、管理员、行政、律师、律助
**部门角色**: 工伤部、保险部
**核心功能**: 
- 用户认证与权限管理
- 案件创建与跟踪
- 客户管理
- 团队管理

## 🛠️ 技术栈说明

### 前端技术栈
- **框架**: Next.js 14，AppRouter
- **语言**: TypeScript 5.0+
- **状态管理**: zustand
- **UI 组件库**: Ant Design 5.19+
- **样式处理**: SCSS 模块
- **认证**: BetterAuth 1.3.27

### 后端技术栈
- **运行时**: Node.js 18+
- **框架**: Express.js 4.19+
- **语言**: TypeScript 5.0+
- **数据库**: PostgreSQL + Drizzle ORM
- **认证**: BetterAuth 1.3.27
- **API 风格**: RESTful API

### 开发工具
- **包管理器**: pnpm
- **数据库迁移**: Drizzle Kit
- **代码检查和格式化**: ESLint

## 📁 项目结构
- `projects/server-project` – TypeScript + Express 认证服务，使用 Better Auth。
- `projects/web-project` – Next.js 14 登录体验，使用 Ant Design 和 SCSS 模块。
- `packages/eslint-config` – 共享的 ESLint 配置。

## 🚀 快速开始

```powershell
pnpm install
```

### 常用脚本

```powershell
pnpm dev:server   # 以监听模式运行 Express API
pnpm dev:web      # 启动 Next.js 开发服务器
pnpm lint         # 在整个工作区运行 lint
pnpm clean        # 清理所有构建产物和 node_modules
pnpm build        # 构建所有项目
pnpm db:rest      # 重置数据库到初始状态
pnpm db:seed      # 向数据库添加初始数据
pnpm db:generate  # 生成数据库迁移文件
pnpm db:migrate   # 运行数据库迁移
pnpm db:push      # 本地仅需执行此命令即可，将数据库模式推送到数据库
```

## 代码生成规范
- 对生成的代码进行注释，尤其是复杂的方法、数据库或者一些第三方库的参数说明，以便生成更好的类型定义和文档。
- 保持代码风格一致，遵循 ESLint 规则。
- 数据交互时，确保前后端接口的一致性，使用共享的类型定义文件。
- 状态管理时，优先使用`zustand`，保持状态逻辑的简洁和高效。
- 对于 UI 组件，遵循 Ant Design 的设计规范，确保界面的一致性和用户体验。
- 对于数据库的操作，只需要在结论时进行文案说明即可，不需要执行数据库更新等操作命令
- 在处理认证和权限时，确保使用 BetterAuth 提供的最佳实践，保障系统的安全性。
- 中文输出结果
- 每次任务完成后无需进行前端构建验证