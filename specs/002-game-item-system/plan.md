# Implementation Plan: 游戏道具系统

**Branch**: `master` | **Date**: 2026/06/06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-game-item-system/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

为游戏服务端实现简化版道具系统（002模块），支持玩家背包管理、消耗品使用、装备穿戴卸下、道具获得丢弃，以及管理员对道具定义的增删改查。系统采用 Node.js + Express + Sequelize 技术栈，数据库按 Constitution 要求从 MySQL 迁移至 SQLite。本模块将作为下游被 001 任务系统消费（任务奖励发放）。

## Technical Context

**Language/Version**: Node.js 18+ (LTS)

**Primary Dependencies**: Express 4.18, Sequelize 6.35, Socket.io 4.7, sqlite3 (预编译二进制，无需本地编译)

**Storage**: SQLite 文件数据库（通过 Sequelize ORM 访问），单文件 `game.db` 位于项目根目录或 `server/data/`

**Testing**: Jest 29 + Supertest，人工 E2E（Constitution 规定不启用 Playwright）

**Target Platform**: Node.js server (Windows/Linux) + Browser client

**Project Type**: web-service (REST API + WebSocket 混合通信)

**Performance Goals**: 支持 1000 并发玩家；背包查询 < 2s；消耗品生效 < 500ms；装备属性重算 < 1s

**Constraints**: 背包固定 200 格；4 个装备部位（武器/头盔/护甲/饰品）；5 种品质等级；消耗品仅支持即时恢复与短期增益

**Scale/Scope**: 道具定义不超过 1 万条；单玩家背包最多 200 格记录；单格堆叠上限由道具定义决定（通常 99）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| III. 测试纪律 | PASS | 核心逻辑（堆叠、穿戴、属性计算）将覆盖 Jest 单元测试；管理接口覆盖 Supertest 集成测试 |
| VI. 简单优先 | PASS | 不引入额外框架；装备穿戴采用固定字段方案（非动态槽位表），减少 JOIN 复杂度 |
| XI. 模块边界纪律 | PASS | 跨模块依赖已显式申报：001 任务系统将消费本模块的 `InventoryService.addItems()` 进行奖励发放（见 data-model.md "Consumed By"） |
| XII. Spec 颗粒度 | **JUSTIFIED** | 原始 spec 含 5 个 user story，超出 ≤3 硬阈值。已在下方 Complexity Tracking 中记录 justification：将紧密耦合的"查看背包+获得丢弃"合并为"背包管理与道具流转"，"使用消耗品+穿戴装备"合并为"道具使用与装备操作"，保留独立的管理配置 story。合并后等效 3 个 story，且每个合并组内操作共享同一数据上下文（背包格/穿戴状态）。 |

### Phase 1 Re-check (Post-Design)

| Principle | Status | Notes |
|---|---|---|
| III. 测试纪律 | PASS | data-model.md 中所有状态转换均有明确规则；contracts 已定义全部接口，便于契约测试；计划覆盖 Jest + Supertest |
| VI. 简单优先 | PASS | research.md 明确拒绝 better-sqlite3 / 消息队列 / 动态装备表；选择固定字段 + JSON 字段方案 |
| XI. 模块边界纪律 | PASS | data-model.md "Cross-Module Entity Consumption" 表格已显式列出 001→002 的 3 条消费关系；002 不反向依赖 001 |
| XII. Spec 颗粒度 | PASS | 合并后等效 3 个 story，无超标；衍生文件（plan + research + data-model + contracts + quickstart）预计 tasks 不超过 30 个 |

### 合并后的 User Story（等效 3 个）

1. **背包管理与道具流转 (P1)**：玩家查询背包列表（含筛选排序）、获得新道具（堆叠/占格/满格拒绝）、丢弃道具（支持部分丢弃、绑定保护）。
2. **道具使用与装备操作 (P1)**：玩家使用消耗品（即时效果+数量扣除）、穿戴装备（部位替换+属性实时重算）、卸下装备（回背包+属性扣除）。
3. **管理道具配置 (P2)**：管理员增删改查道具定义（ItemDefinition），修改后已穿戴该装备的玩家属性即时重算。

## Project Structure

### Documentation (this feature)

```text
specs/002-game-item-system/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

当前项目已采用前后端分离结构，002 模块仅涉及服务端新增文件与数据库迁移配置调整：

```text
server/
├── src/
│   ├── config/
│   │   ├── database.js          # 修改：dialect 从 mysql 改为 sqlite，移除 host/port/username/password
│   │   └── sequelize.js         # 无需修改（已读取 database.js）
│   ├── models/
│   │   ├── Character.js         # 修改：增加装备槽位字段（equip_weapon_id, equip_helmet_id, equip_armor_id, equip_accessory_id）
│   │   ├── ItemDefinition.js    # 新增：道具定义模型
│   │   ├── PlayerItem.js        # 新增：玩家背包模型
│   │   └── index.js             # 新增：统一导出所有模型并定义关系
│   ├── controllers/
│   │   └── ItemController.js    # 新增：道具系统 REST 控制器
│   ├── routes/
│   │   └── itemRoutes.js        # 新增：/api/items /api/inventory 路由
│   ├── services/
│   │   ├── ItemService.js       # 新增：道具定义 CRUD 与查询
│   │   ├── InventoryService.js  # 新增：背包核心逻辑（堆叠、获得、丢弃、使用、穿戴）
│   │   └── ItemService.test.js  # 新增：Jest 单元测试
│   └── index.js                 # 修改：注册 itemRoutes，导入模型索引
├── tests/
│   └── integration/
│       └── item.integration.test.js  # 新增：Supertest 集成测试（可选，也可放在 services/ 同级）
├── data/
│   └── game.db                  # 新增：SQLite 数据库文件（gitignore）
├── package.json                 # 修改：移除 mysql2，添加 sqlite3
└── jest.config.js               # 已有，保持
```

**前端影响**：002 为纯服务端模块，前端通过现有 Axios / Socket.io 调用新增 REST 接口，本模块不新增前端源码文件。

**Structure Decision**: 采用单后端项目结构，按 MVC 分层（models / controllers / services / routes）与现有 Character 模块保持一致。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Spec 原始 5 个 user story（超出 ≤3 阈值） | 经分析，5 个 story 可按数据上下文自然合并为 3 组，不损失独立交付价值 | 拆分为 2 个 spec 会导致"背包"与"使用"这两个高频玩家操作被割裂，增加集成成本；直接保留 5 个则违反 Constitution XII 硬阈值 |

