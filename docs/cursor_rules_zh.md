🌐 [English](cursor_rules.md) | [中文](cursor_rules_zh.md)

---

# Cursor 规则

本项目使用 [Cursor Rules](https://docs.cursor.com/context/rules-for-ai) 为 AI 提供持久化的编码指导。规则为 `.cursor/` 目录下的 `.mdc` 文件，根据上下文自动激活。

## 规则概览

| 规则 | 文件 | 适用范围 | 说明 |
|------|------|----------|------|
| 最小变更与验证 | `validate-minimal-changes.mdc` | 始终生效 | Karpathy 风格：先验证、最小 diff、测试失败先查生产代码 |
| 项目规范 | `project-conventions.mdc` | 始终生效 | 提交、PR、文档、TypeScript/React 风格 |
| 测试失败调试 | `failing-tests-debugging.mdc` | 始终生效 | 先修实现，再考虑改测试 |
| 成本优化 | `cost-optimization.mdc` | 始终生效 | 简洁输出、高效工具调用 |
| 简洁回复 | `concise-responses.mdc` | 始终生效 | 短而可扫读的答复 |
| Git 工作流 | `git-workflow.mdc` | 始终生效 | 功能分支、hooks：`./utils/setup-hooks.sh` |
| React Web | `react-web.mdc` | `src/**/*.{ts,tsx}` | Vite、React Router、`api.ts`、Tailwind |
| 测试 | `testing.mdc` | `src/**/*.test.{ts,tsx}` | Vitest + Testing Library |
| CI 工作流 | `ci-workflows.mdc` | `.github/workflows/**` | `webapp-ci.yml`、部署 |
| 设计文档 | `design-docs.mdc` | `docs/design-doc/**` | 仅英文设计文档格式 |
| 调试日志 | `debug-logging.mdc` | 编辑任意文件时 | `logs/debug.log` 路径与埋点 |

## 规则如何工作

- **始终生效** 的规则在每次 AI 对话中都会激活，无论打开了哪些文件。
- **文件范围** 的规则在打开或编辑匹配 glob 模式的文件时自动激活。
- 规则只是为 AI 提供的只读指导——不会修改代码或强制执行 lint 检查。

## 规则详情

### 最小变更与验证（始终生效）

- 编辑前后对照当前代码验证
- 最小、精准的 diff；不做顺手重构
- 不要为了通过测试而改测试——先查生产代码
- Web 测试模式：见 `testing.mdc` 与 `react-web.mdc`

### 项目规范（始终生效）

- **提交/PR**：`<type>(<scope>): <subject>`，PR 聚焦，squash merge
- **Git**：仅功能分支，禁止直推 `main`，hooks：`./utils/setup-hooks.sh`
- **CI**：`webapp-ci.yml` — `npm run test:run`、`npm run build`
- **文档**：已有中英文配对的保持双语；设计文档仅英文
- **API**：`../retentio-backend/docs/api.md`

### React Web（文件范围）

- Vite + React 18 + TypeScript + Tailwind + React Router v6
- HTTP 经 `src/lib/api.ts`；认证 token 存于 `localStorage`

### 测试（文件范围）

- Vitest + Testing Library + user-event
- API 用 mock `fetch`；路由页面用 `MemoryRouter`

## 添加新规则

1. 在 `.cursor/` 中创建 `.mdc` 文件
2. 添加 YAML frontmatter：`description`、`globs`（可选）、`alwaysApply`
3. 规则保持简洁且可操作
4. 添加或修改规则时请更新本文档

后端 API 文档：`../retentio-backend/docs/api.md`。本地开发：`docs/development.md`。
