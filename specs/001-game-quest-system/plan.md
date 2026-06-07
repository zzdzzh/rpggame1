# Implementation Plan: 游戏任务系统

**Branch**: `[001-game-quest-system]` | **Date**: 2026/06/07 | **Spec**: [specs/001-game-quest-system/spec.md](spec.md)

**Input**: Feature specification from `/specs/001-game-quest-system/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

为服务端增加一套简化的 RPG 任务系统，覆盖任务配置的增删改查、玩家接取任务、任务目标实时跟踪、任务提交与奖励领取等核心闭环。系统复用现有 Express + Sequelize + SQLite 技术栈，通过 Service 层直接调用对接 002 道具系统的背包接口，不引入新的运行时组件。

## Technical Context

**Language/Version**: Node.js 20+ LTS

**Primary Dependencies**: Express 4.18, Sequelize 6.35, sqlite3 6.0, socket.io 4.7, jest 29, supertest

**Storage**: SQLite (文件 `server/data/game.db`，通过 Sequelize ORM 访问)

**Testing**: Jest + supertest（REST 接口集成测试），Service 层单元测试；`npm test` 在 `server/` 目录下运行

**Target Platform**: Windows 开发环境 / 跨平台部署

**Project Type**: web-service（游戏服务端）

**Performance Goals**: 1000 并发玩家同时查询与进度更新无明显延迟；可接任务列表查询 ≤3s；任务进度同步 ≤1s

**Constraints**: 活跃任务定义不超过 1 万条；玩家同时可接取任务上限 20 个；简单优先 / YAGNI

**Scale/Scope**: 单服架构；V1 仅支持击杀、收集、到达、对话 4 种目标类型；不实现限时、护送等复杂类型

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 检查项 | 结果 | 备注 |
|---|---|---|---|
| III. 测试纪律 | 核心业务路径是否有测试规划 | PASS | Plan 中包含 QuestService、QuestProgressService、QuestRewardService 的单元测试及 REST 接口集成测试 |
| III. 测试纪律 | 奖励发放等数据完整性逻辑是否要求 100% 分支覆盖 | PASS | 奖励发放流程在 tasks.md 中标记为需 100% 分支覆盖 |
| VI. 简单优先 | 是否引入当前阶段不需要的新框架/运行时 | PASS | 零新增运行时；复用现有 Express/Sequelize/Socket.io 栈 |
| XI. 模块边界纪律 | 跨 spec 实体消费是否显式申报 | PASS | 已在 spec.md "附加说明" 及本 plan data-model.md 中显式申报对 002 `ItemDefinition`/`PlayerItem`/`InventoryService` 的消费 |
| XII. Spec 颗粒度 | User story 数量 ≤5 | PASS | 4 个 user story |

**Re-check after Phase 1**: 待 data-model.md 和 contracts/ 完成后再次确认模块边界与复杂度。

## Project Structure

### Documentation (this feature)

```text
specs/001-game-quest-system/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── quest-api.md
│   └── quest-admin-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
server/
├── src/
│   ├── config/
│   │   └── sequelize.js          # 已有，复用
│   ├── models/
│   │   ├── Quest.js              # 任务定义（目标/奖励/触发条件以 JSON 字段存储）
│   │   └── PlayerQuest.js        # 玩家任务实例
│   ├── controllers/
│   │   ├── QuestController.js    # 玩家侧接口
│   │   └── QuestAdminController.js # 管理侧接口
│   ├── routes/
│   │   ├── questRoutes.js
│   │   └── questAdminRoutes.js
│   ├── services/
│   │   ├── QuestService.js       # 任务查询与接取
│   │   ├── QuestProgressService.js # 进度跟踪与提交
│   │   ├── QuestRewardService.js # 奖励领取
│   │   └── QuestAdminService.js  # 管理 CRUD
│   └── migrations/
│       ├── YYYYMMDDHHMMSS-create-quest.js
│       └── YYYYMMDDHHMMSS-create-player-quest.js
├── tests/
│   ├── integration/
│   │   └── quest.integration.test.js
│   └── unit/
│       ├── QuestService.test.js
│       ├── QuestProgressService.test.js
│       └── QuestRewardService.test.js
└── package.json                # 已有，零新增依赖
```

**Structure Decision**: 采用现有单项目结构（Option 1），与 002 道具系统保持一致。新增模型、控制器、路由、服务均放入现有 `server/src/` 对应目录。测试目录沿用现有 `server/tests/` 结构。

**JSON Flattening Decision**: 任务目标、奖励、触发条件均以 JSON 字段存储在 `Quest` 表中（`objectives_json`、`rewards_json`、`trigger_conditions_json`），不拆分为独立关联表。详见 `research.md` Decision 3。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

本次设计无 Constitution 违规，无需额外复杂度记录。
