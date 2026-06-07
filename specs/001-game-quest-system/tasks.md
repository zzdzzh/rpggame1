# Tasks: 游戏任务系统

**Input**: Design documents from `/specs/001-game-quest-system/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Tests**: 包含集成测试与单元测试任务。Constitution III 要求核心业务路径必须有自动化测试覆盖。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 确认现有项目依赖已满足任务系统需求，无需新增运行时组件

- [ ] T001 验证 `server/package.json` 已包含 Express/Sequelize/SQLite/Socket.io，确认零新增依赖

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 核心数据模型与数据库迁移，必须在任何用户故事之前完成

**⚠️ CRITICAL**: 所有用户故事依赖本阶段的模型和数据库表

- [ ] T002 [P] 创建 Quest 模型 `server/src/models/Quest.js`（含 objectives_json / rewards_json / trigger_conditions_json / prerequisites_json JSON 字段）
- [ ] T003 [P] 创建 PlayerQuest 模型 `server/src/models/PlayerQuest.js`（含 progress_json JSON 字段与 status ENUM）
- [ ] T004 [P] 创建 Quest 表迁移 `server/src/migrations/YYYYMMDDHHMMSS-create-quest.js`
- [ ] T005 [P] 创建 PlayerQuest 表迁移 `server/src/migrations/YYYYMMDDHHMMSS-create-player-quest.js`
- [ ] T006 执行数据库迁移 `npm run migrate`

**Checkpoint**: 数据库表已创建，模型可通过 Sequelize 正常读写

---

## Phase 3: User Story 1 - 查询并接取任务 (Priority: P1) 🎯 MVP

**Goal**: 玩家可按条件查询可接任务列表，并接取满足条件的任务

**Independent Test**: 调用 `GET /api/quests/available` 应返回过滤后的可接任务；调用 `POST /api/quests/:questId/accept` 后数据库应出现对应 PlayerQuest 记录且状态正确

### Implementation for User Story 1

- [ ] T007 实现 QuestService 查询与接取逻辑 `server/src/services/QuestService.js`（getAvailableQuests / acceptQuest）
- [ ] T008 实现 QuestController 玩家查询与接取接口 `server/src/controllers/QuestController.js`
- [ ] T009 创建 questRoutes `server/src/routes/questRoutes.js`
- [ ] T010 注册 questRoutes 到主应用 `server/src/index.js`
- [ ] T011 编写 US1 集成测试 `server/tests/integration/quest-us1.integration.test.js`

**Checkpoint**: US1 可独立运行并通过测试：玩家能查询可接任务并成功接取

---

## Phase 4: User Story 2 - 完成任务目标并提交 (Priority: P1)

**Goal**: 系统实时跟踪任务进度，目标全部达成后玩家可提交任务

**Independent Test**: 模拟击杀/收集/到达/对话事件后，PlayerQuest.progress_json 正确更新；所有目标达成后调用 `POST /api/quests/:playerQuestId/submit` 状态变为 `ready_for_reward`

### Implementation for User Story 2

- [ ] T012 实现 QuestProgressService 进度跟踪与提交 `server/src/services/QuestProgressService.js`（updateProgress / submitQuest）
- [ ] T013 扩展 QuestController 添加提交接口 `server/src/controllers/QuestController.js`
- [ ] T014 扩展 questRoutes 添加提交路由 `server/src/routes/questRoutes.js`
- [ ] T015 实现 Socket.io 任务进度推送 `server/src/services/QuestProgressService.js`（emit `questUpdate` / `questReadyForReward`）
- [ ] T016 编写 US2 集成测试 `server/tests/integration/quest-us2.integration.test.js`

**Checkpoint**: US2 可独立运行并通过测试：进度更新、提交任务、WebSocket 推送均正常

---

## Phase 5: User Story 3 - 领取任务奖励 (Priority: P1)

**Goal**: 玩家对 `ready_for_reward` 状态的任务领取奖励，经验/货币/道具一次性发放

**Independent Test**: 调用 `POST /api/quests/:playerQuestId/claim` 后，PlayerQuest 状态变为 `completed`，角色经验/金币增加，道具通过 InventoryService.addItems 进入背包；背包不足时返回错误且状态不变

### Implementation for User Story 3

- [ ] T017 实现 QuestRewardService 奖励领取 `server/src/services/QuestRewardService.js`（claimReward，对接 InventoryService.addItems）
- [ ] T018 扩展 QuestController 添加领奖接口 `server/src/controllers/QuestController.js`
- [ ] T019 扩展 questRoutes 添加领奖路由 `server/src/routes/questRoutes.js`
- [ ] T020 编写 US3 集成测试 `server/tests/integration/quest-us3.integration.test.js`

**Checkpoint**: US3 可独立运行并通过测试：奖励一次性发放，事务回滚正确

---

## Phase 6: User Story 4 - 管理任务配置 (Priority: P2)

**Goal**: 管理员可通过接口查询、创建、修改、删除（仅无人接取时）任务配置

**Independent Test**: 管理接口 CRUD 操作后，Quest 表数据正确持久化；删除已有人接取的任务应被拒绝

### Implementation for User Story 4

- [ ] T021 实现 QuestAdminService 管理 CRUD `server/src/services/QuestAdminService.js`
- [ ] T022 实现 QuestAdminController 管理接口 `server/src/controllers/QuestAdminController.js`
- [ ] T023 创建 questAdminRoutes `server/src/routes/questAdminRoutes.js`
- [ ] T024 注册 questAdminRoutes 到主应用 `server/src/index.js`
- [ ] T025 编写 US4 集成测试 `server/tests/integration/quest-us4.integration.test.js`

**Checkpoint**: US4 可独立运行并通过测试：管理端 CRUD 与上架/下架功能正常

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 单元测试补全、跨故事回归验证

- [ ] T026 [P] 编写 QuestService 单元测试 `server/tests/unit/QuestService.test.js`
- [ ] T027 [P] 编写 QuestProgressService 单元测试 `server/tests/unit/QuestProgressService.test.js`
- [ ] T028 [P] 编写 QuestRewardService 单元测试 `server/tests/unit/QuestRewardService.test.js`
- [ ] T029 [P] 编写 QuestAdminService 单元测试 `server/tests/unit/QuestAdminService.test.js`
- [ ] T030 运行完整测试套件验证 `npm test`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始
- **Foundational (Phase 2)**: 依赖 Setup；阻塞所有用户故事
- **User Stories (Phase 3-6)**: 均依赖 Foundational 完成
  - US1、US2、US3、US4 在 Foundational 完成后可并行开发（若团队容量允许）
  - 推荐按优先级顺序串行：US1 → US2 → US3 → US4
- **Polish (Phase 7)**: 依赖所有用户故事完成

### User Story Dependencies

- **US1 (P1)**: Foundational 完成后即可开始；不依赖其他 user story
- **US2 (P1)**: Foundational 完成后即可开始；依赖 US1 的 QuestController / questRoutes 已存在（但 QuestProgressService 可独立实现）
- **US3 (P1)**: Foundational 完成后即可开始；依赖 US2 的提交状态，但奖励领取逻辑可独立实现
- **US4 (P2)**: Foundational 完成后即可开始；管理端与玩家端独立，不依赖 US1-US3

### Within Each User Story

- Service 层在 Controller 之前实现
- Controller 在 Routes 之前实现
- Routes 注册到主应用后才能进行集成测试
- 各 story 的核心 Service 可并行开发（不同文件，无共享未完成的依赖）

### Parallel Opportunities

- Phase 2 中 T002-T005（模型与迁移）可并行
- Phase 7 中 T026-T029（单元测试）可并行
- US1-US4 的 Service 实现可在 Foundational 完成后并行（QuestService / QuestProgressService / QuestRewardService / QuestAdminService 互不影响）

---

## Parallel Example: User Story 1 + User Story 4

```bash
# Foundational 完成后，团队可并行开发玩家端与管理端：
Task: "实现 QuestService 查询与接取逻辑 server/src/services/QuestService.js"
Task: "实现 QuestAdminService 管理 CRUD server/src/services/QuestAdminService.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational（模型 + 迁移）
3. 完成 Phase 3: US1（查询 + 接取任务）
4. **STOP and VALIDATE**: 独立测试 US1
5. 此时玩家已能查询和接取任务，构成最小可用闭环

### Incremental Delivery

1. Setup + Foundational → 基础就绪
2. US1 → 查询/接取任务 → 验证并演示（MVP）
3. US2 → 进度跟踪/提交 → 验证并演示
4. US3 → 奖励领取 → 验证并演示（任务闭环完成）
5. US4 → 管理配置 → 验证并演示
6. 每个 story 独立添加价值，不破坏已有功能

### Parallel Team Strategy

多人协作时：

1. 共同完成 Setup + Foundational
2. Foundational 完成后分兵：
   - 开发者 A: US1 + US2（玩家端流程）
   - 开发者 B: US3（奖励发放，对接 002）
   - 开发者 C: US4（管理端）
3. 各 story 完成后统一集成测试

---

## Notes

- [P] tasks = 不同文件，无依赖关系，可并行执行
- [Story] label 将任务映射到具体 user story，便于追溯
- 任务描述中的文件路径基于 `plan.md` 的项目结构
- 跨模块调用约束：001 对 002 的 `InventoryService.addItems` / `hasItems` 调用必须在 002 的 `contracts/internal-service.md` 定义的签名范围内；如需变更，先到 002 模块增补修改任务
- Constitution XII 要求单个 sprint ≤30 task；本任务列表共 30 个任务，为硬阈值上限
