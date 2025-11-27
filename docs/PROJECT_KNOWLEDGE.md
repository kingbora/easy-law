# 法律案件管理系统 (Easy Law) - 项目知识库

> **文档说明**: 本文档由全栈开发专家生成，旨在为 AI Agent 及开发团队提供当前工程的完整上下文、架构设计、业务逻辑及开发规范。后续所有新增功能与修改均应以此文档为基准，并保持文档的实时更新。

## 1. 项目概览

*   **项目名称**: 法律案件管理系统 (Easy Law)
*   **核心业务**: 为律所提供案件全生命周期管理，包括案件录入、进度跟踪、客户管理、团队协作及权限控制。
*   **业务部门**: 工伤部 (Work Injury)、保险部 (Insurance)。
*   **系统架构**: 前后端分离 (Monorepo)，基于 TypeScript 全栈开发。

## 2. 技术栈与架构

### 2.1 Monorepo 结构 (pnpm workspace)
项目采用 Monorepo 策略管理代码，确保类型共享与依赖统一。

*   `packages/shared-types`: **核心共享库**。包含前后端共用的 TypeScript 类型定义、常量枚举、权限定义 (Access Control)。
    *   *原则*: 凡是涉及前后端交互的数据结构、枚举值，必须定义在此处，严禁在前后端重复定义。
*   `projects/server-project`: **后端服务**。
    *   **运行时**: Node.js
    *   **框架**: Express.js
    *   **ORM**: Drizzle ORM
    *   **数据库**: PostgreSQL
    *   **认证**: BetterAuth (服务端插件)
*   `projects/web-project`: **前端应用**。
    *   **框架**: Next.js 14 (App Router)
    *   **UI 库**: Ant Design 5.x + SCSS Modules
    *   **状态管理**: Zustand
    *   **认证**: BetterAuth (客户端)

### 2.2 核心技术选型
*   **语言**: TypeScript 5.0+ (全栈强类型)
*   **包管理**: pnpm
*   **数据库迁移**: Drizzle Kit
*   **代码规范**: ESLint + Prettier

## 3. 数据库与数据模型 (Data Model)

数据库采用 PostgreSQL，通过 Drizzle ORM 进行管理。

### 3.1 核心 Schema (`projects/server-project/src/db/schema`)

#### 身份认证 (`auth-schema.ts`)
*   **Users (`user`)**: 用户基础表。
    *   `role`: 角色 (super_admin, admin, administration, lawyer, assistant, sale)。
    *   `department`: 部门 (work_injury, insurance)。
    *   `supervisorId`: 上级 ID。
*   **Sessions (`session`)**: 用户会话管理。
*   **Accounts (`account`)**: 第三方登录关联 (如有)。

#### 案件管理 (`case-schema.ts`)
*   **Cases (`case_record`)**: 核心案件表。
    *   `caseType`: 案件类型 (工伤、人损、其他)。
    *   `caseStatus`: 状态 (open, closed, void)。
    *   `caseLevel`: 案件评级 (A, B, C)。
    *   `contractQuoteType`: 报价方式 (固定、风险、其他)。
    *   `assignedLawyerId`, `assignedAssistantId`, `assignedSaleId`: 案件相关人员绑定。
    *   `insuranceTypes`, `insuranceMisrepresentations`: JSONB 字段，存储复杂结构数据。
    *   **2024 年 11 月更新**: `province_city` 字段已拆分为 `province` (静态省份下拉) 与 `city` (手工输入)，并同步去掉了 `fee_standard`。工伤案件沿用保险案件的收费字段组合（`contractQuote*`、`litigationFeeType`、`travelFeeType` 等）。

### 3.2 关键枚举 (Shared Types)
所有枚举定义在 `packages/shared-types` 中，确保数据库存储值与前端逻辑一致。
*   `USER_ROLES`: 用户角色。
*   `CASE_STATUS`: 案件状态。
*   `CASE_TIME_NODE_TYPES`: 案件关键时间节点类型 (如：申请工认、劳动仲裁、一审判决等)。

## 4. 权限与认证体系 (Auth & RBAC)

系统使用 **BetterAuth** 进行认证，结合自定义的 RBAC (基于角色的访问控制)。

### 4.1 角色定义
*   **Super Admin**: 超级管理员，拥有所有权限。
*   **Admin**: 管理员，管理部门事务。
*   **Administration**: 行政，负责流程审批、归档。
*   **Lawyer**: 律师，负责案件办理。
*   **Assistant**: 律助，协助律师。
*   **Sale**: 销售，负责线索录入与客户跟进。

### 4.2 权限控制 (`packages/shared-types/src/permissions.ts`)
使用 `better-auth/plugins/access` 定义权限声明 (`statements`)。
*   **资源**: `team`, `case`, `client`, `user`。
*   **操作**: `list`, `create`, `update`, `delete`, `add-member` 等。
*   **实现**: 后端通过中间件或 Service 层校验 `ac.newRole` 定义的权限；前端根据用户 Role 控制菜单和按钮显示。

## 5. 接口与通信 (API)

### 5.1 设计风格
*   **RESTful API**: 基础 CRUD 操作。
*   **Base URL**: `/restful` (后端挂载点)。

### 5.2 客户端封装 (`projects/web-project/lib/api-client.ts`)
*   封装了 `fetch`，自动处理 Base URL 和 JSON 序列化。
*   统一错误处理 `ApiError`。
*   **约定**: 前端调用 API 时，应当使用 `packages/shared-types` 中的类型作为泛型参数，确保类型安全。

### 5.3 核心接口权限梳理
| 接口 | 方法 | 允许角色 | 授权逻辑 | 备注 |
| --- | --- | --- | --- | --- |
| `/restful/api/cases/assignable-staff` | GET | `super_admin`, `admin`, `administration`, `lawyer` | `getAssignableStaff` 在 Service 层使用 `ASSIGNABLE_ROLES` 进行白名单校验，并强制管理员/律师只能查看所属部门或同主管成员。超级管理员必须显式指定 `department`。 | 仅用于“指派人员”弹窗，返回候选销售/律师/助理列表。 |
| `/restful/api/cases/responsible-staff` | GET | 拥有案件查询 (`list`) 权限的角色：`super_admin`, `admin`, `administration`, `lawyer`, `assistant`, `sale` | 新增的 `getResponsibleStaffOptions` 复用了 `ensureCasePermission(user, 'list')` 与 `buildCaseAccessContext`，保证仅能聚合当前用户可见案件中的销售/律师/助理。超级管理员依旧需要携带 Tab 部门参数。 | 供案件筛选“负责人”下拉使用，数据来源于实际案件负责人。 |
| `/restful/api/menu-config` | GET | 所有已登录角色 | `menu-config-service.resolveDepartmentForRead` 优先使用 query 参数指定的部门，若缺失则回退为用户所属部门；仅校验部门合法性，不再做角色限制。 | 读取基础配置，以便不同角色在前端加载相同的菜单/阶段选项。 |
| `/restful/api/menu-config` | PUT | `super_admin`, `admin` | `menu-config-service.resolveDepartmentForWrite` 仍限制只有超级管理员/管理员可配置，且管理员只能更新自身部门；校验缺失部门信息会抛出 `AuthorizationError`/`BadRequestError`。 | 配置操作受限，避免普通角色修改菜单。 |

## 6. 目录结构说明

### 后端 (`projects/server-project`)
*   `src/routes`: 路由定义 (Controller 层)。
*   `src/services`: 业务逻辑层 (Service 层)，处理复杂业务，**禁止在 Route 中写复杂逻辑**。
*   `src/db/schema`: 数据库定义。
*   `src/auth`: BetterAuth 配置。

### 前端 (`projects/web-project`)
*   `app/(dashboard)`: 业务主界面，包含布局 Layout。
*   `app/(auth)`: 登录、忘记密码等页面。
*   `components`: 通用组件及业务组件 (按模块划分，如 `cases`, `clients`)。
*   `lib/api-client.ts`: API 请求工具。
*   `lib/stores`: Zustand 状态管理。

## 7. 专家架构建议与开发规范

作为全栈开发专家，针对当前架构提出以下建议，后续开发请严格遵守：

### 7.1 类型安全 (Type Safety)
*   **强制共享**: 任何 DTO (Data Transfer Object)、API 响应结构、枚举，**必须** 定义在 `packages/shared-types`。
*   **禁止 Any**: 严禁使用 `any`，特殊情况使用 `unknown` 并配合类型守卫。
*   **Zod 校验**: 建议引入 `zod` 在 `shared-types` 中定义 Schema，前后端共用运行时校验 (后端校验 Request Body，前端校验 Form)。

### 7.2 业务逻辑分层 (Service Layer Pattern)
*   **Controller (Routes)**: 仅负责 HTTP 请求解析、参数验证、调用 Service、返回响应。
*   **Service**: 负责核心业务逻辑、数据库原子操作、事务处理。
*   **Model (Drizzle)**: 仅负责数据定义。
*   **现状优化**: 目前部分逻辑可能散落在 Route 中，后续开发应严格下沉至 Service 层。

### 7.3 状态管理 (State Management)
*   **Server State**: 使用 React Query (TanStack Query) 或 SWR 管理服务端数据 (建议引入，目前主要靠 `useEffect` + `api-client`，容易导致竞态问题和缓存管理困难)。
*   **Client State**: 继续使用 Zustand 管理全局 UI 状态 (如 Sidebar 开关、当前用户信息)。

### 7.4 错误处理 (Error Handling)
*   后端统一使用 `http-errors` 或自定义异常类，通过 Error Middleware 统一捕获并返回标准 JSON 格式。
*   前端统一拦截 API 错误，通过 Ant Design 的 `message` 或 `notification` 组件提示用户。

### 7.5 数据库操作
*   **事务**: 涉及多表更新 (如创建案件同时创建关联日志) 必须使用 `db.transaction`。
*   **软删除**: 尽量使用 `banned` 或 `status='void'` 代替物理删除 (`delete`)，保留数据痕迹。

### 7.6 组件设计
*   **Headless UI**: 复杂交互逻辑与 UI 分离。
*   **模块化**: 避免 `page.tsx` 过大，将业务模块拆分为独立的 Feature Components 放入 `components/<module>/`。

## 8. 后续开发路线图 (Roadmap)

1.  **完善测试**: 引入 Jest 或 Vitest，针对 `shared-types` 和 `server-project/services` 编写单元测试。
2.  **API 文档**: 集成 Swagger/OpenAPI，利用 Zod Schema 自动生成文档。
3.  **CI/CD**: 配置 GitHub Actions，实现自动化 Lint、Test 和 Docker 构建。
