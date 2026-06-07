# Implementation Plan: 道具配置管理前台

**Branch**: `[003-item-config-frontend]` | **Date**: 2026/06/07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-item-config-frontend/spec.md`

## Summary

为 002-game-item-system 配套开发道具配置管理前台页面，集成到现有 Vue 3 客户端（`client/` 目录），提供道具定义的列表查看、创建、编辑、删除及筛选搜索功能。前台作为 002 模块的纯消费者，直接复用 002 定义的数据模型与 HTTP 契约，不另建后端服务。

## Technical Context

**Language/Version**: JavaScript (ES2022) / Vue 3.3.8 / Vite 5.0.4

**Primary Dependencies**: Vue 3, Pinia 2.1.7, Axios 1.6.2, Element Plus (新增，用于管理后台表格/表单/弹窗/分页组件)

**Storage**: N/A（纯前端，数据持久化由 002 后端通过 SQLite 处理）

**Testing**: 人工 E2E 测试（遵循 Constitution，不使用 Playwright）；前台以数据绑定和 API 调用为主，业务逻辑极少，不单独规划单元测试

**Target Platform**: Web 浏览器（Modern browsers with ES2022 support）

**Project Type**: web-application frontend（游戏客户端内的管理后台页面）

**Performance Goals**: 页面首屏加载 < 3s，列表筛选响应 < 1s，表单提交反馈 < 2s

**Constraints**:
- 必须集成到现有 `client/` 目录，不另起项目或仓库
- 禁止修改 002 模块的 data-model、contracts 和服务实现
- 前端枚举展示必须使用中文标签（类型、品质、装备部位）
- 遵循 Constitution 简单优先原则，不引入当前阶段不需要的框架

**Scale/Scope**: 单页面管理后台，面向管理员用户，预期并发操作人数 < 10

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 状态 | 说明 |
|------|------|------|
| III. 测试纪律 | 通过 | 核心业务逻辑在 002 后端已覆盖；前台为纯展示层，人工 E2E 验收即可 |
| VI. 简单优先 | 通过 | 仅新增 Element Plus 一个依赖；不引入 Vue Router（用条件渲染切换页面），不新增构建工具 |
| VIII. 用户界面可视化验证 | 通过 | Constitution 已明确豁免 Playwright，采用人工 E2E 测试；计划完成时提供截图存证 |
| IX. 视觉质量标准 | 通过 | Element Plus 提供专业的视觉基础；空状态/加载态/错误态由组件库内置支持 |
| XI. 模块边界纪律 | 通过 | 本模块为 002 的消费者，不拥有 ItemDefinition 实体，契约直接引用 002/contracts |
| XII. Spec 颗粒度纪律 | 通过 | Spec 含 5 个 User Story，紧密耦合于同一管理页面，符合 ≤5 阈值 |

**Re-check after Phase 1**: 设计完成后确认无新增依赖、无跨模块实体变更。

## Project Structure

### Documentation (this feature)

```text
specs/003-item-config-frontend/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output（前台视角的数据结构与枚举映射）
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output（前台服务层契约）
└── tasks.md             # Phase 2 output（由 /speckit-tasks 生成）
```

### Source Code (repository root)

```text
client/
├── src/
│   ├── App.vue                      # 增加游戏画面与管理页面的切换入口
│   ├── main.js                      # 注册 Element Plus 及中文语言包
│   ├── views/
│   │   ├── GameView.vue             # 现有游戏主界面（原 game/GameView.vue 迁移或保持）
│   │   └── ItemConfigView.vue       # 道具配置管理主页面
│   ├── components/
│   │   ├── item-config/
│   │   │   ├── ItemList.vue         # 道具列表（表格 + 分页 + 筛选搜索栏）
│   │   │   ├── ItemForm.vue         # 创建/编辑表单（动态字段切换）
│   │   │   └── ItemDeleteDialog.vue # 删除确认弹窗
│   ├── services/
│   │   └── itemAdminService.js      # 封装对 002 Item Admin API 的 Axios 调用
│   └── stores/
│       └── itemConfigStore.js       # Pinia Store：列表状态、表单状态、加载态
├── package.json                     # 追加 element-plus 依赖
└── vite.config.js                   # 如有需要配置代理指向本地 server
```

**Structure Decision**: 采用单项目内新增目录的方式，在现有 `client/src` 下新增 `views/`、`components/item-config/`、`services/` 目录。不拆分独立项目，保持与现有游戏客户端同一构建流程。将原 `game/GameView.vue` 保留在 `game/` 下或迁移到 `views/GameView.vue`（视具体实施而定，plan 阶段不做强制迁移）。

## Complexity Tracking

> 新增 Element Plus 的理由：Constitution 已规定前台技术栈包含 Element Plus；且管理后台所需表格、表单、弹窗、分页若全部自行实现，代码量与维护成本远高于引入一个成熟组件库。无更简单替代方案。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 新增 1 个依赖 (Element Plus) | Constitution 规定 + 管理后台需要表格/表单/弹窗/分页 | 纯手写 CSS + Vue 组件会导致大量重复代码和视觉不一致 |
