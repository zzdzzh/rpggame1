# Tasks: 游戏道具系统

**Input**: Design documents from `/specs/002-game-item-system/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included per Constitution III (测试纪律) — 核心业务逻辑覆盖 Jest 单元测试，管理接口覆盖 Supertest 集成测试。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 数据库迁移与项目依赖调整

- [x] T001 更新 `server/package.json`：移除 `mysql2`，添加 `sqlite3` 依赖
- [x] T002 更新 `server/src/config/database.js`：改为 SQLite 单文件配置；创建 `server/data/` 目录并在 `.gitignore` 中排除 `*.db`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 核心数据模型与基础设施，必须在任何用户故事开始前完成

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [P] 修改 `server/src/models/Character.js`：增加装备槽位字段（`equip_weapon_id`, `equip_helmet_id`, `equip_armor_id`, `equip_accessory_id`）
- [x] T004 [P] 创建 `server/src/models/ItemDefinition.js`：道具定义模型（含 JSON 字段 `consumable_effect`、`equipment_stats`）
- [x] T005 [P] 创建 `server/src/models/PlayerItem.js`：玩家背包模型
- [x] T006 创建 `server/src/models/index.js`：统一导出所有模型并定义 Sequelize 关系（Character↔PlayerItem, ItemDefinition↔PlayerItem）
- [x] T007 创建 Sequelize 迁移文件：Character 扩展字段 + ItemDefinition 表 + PlayerItem 表
- [x] T008 运行迁移生成 SQLite 表结构，验证 `server/data/game.db` 正常创建

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 背包管理与道具流转 (Priority: P1) 🎯 MVP

**Goal**: 玩家可查询背包（筛选排序）、获得新道具（自动堆叠/占格/满格拒绝）、丢弃道具（支持部分丢弃、绑定保护）

**Independent Test**: 通过 Jest 单元测试验证堆叠逻辑与容量边界；通过 Supertest 验证查询接口返回结构与筛选正确性

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T009 [P] [US1] 编写 `server/src/services/InventoryService.test.js`：覆盖 addItems 堆叠逻辑、满格拒绝、discardItem 部分丢弃与绑定保护
- [x] T010 [P] [US1] 编写 `server/tests/integration/inventory.integration.test.js`：覆盖 GET /api/inventory 筛选排序与容量统计

### Implementation for User Story 1

- [x] T011 [US1] 实现 `server/src/services/InventoryService.js` 的 `addItems(characterId, items)`：优先堆叠到已有格子，无法堆叠占新格，背包满则整单回滚
- [x] T012 [US1] 实现 `server/src/services/InventoryService.js` 的 `discardItem(characterId, playerItemId, quantity)`：支持部分丢弃，已绑定道具拒绝丢弃，数量为0时删除记录
- [x] T013 [US1] 实现 `server/src/services/InventoryService.js` 的 `getInventory(characterId, filters)`：按类型筛选、支持排序、返回 `slots_used/slots_total`
- [x] T014 [US1] 实现 `server/src/controllers/ItemController.js` 背包相关接口（查询、丢弃）并在 `server/src/routes/itemRoutes.js` / `server/src/index.js` 注册路由

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - 道具使用与装备操作 (Priority: P1)

**Goal**: 玩家可使用消耗品（即时效果+数量扣除）、穿戴装备（部位替换+属性实时重算）、卸下装备（回背包+属性扣除）

**Independent Test**: 通过 Jest 单元测试验证效果计算（上限约束）、装备替换流程、属性重算正确性；通过 Supertest 验证接口端到端

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T015 [P] [US2] 编写 `server/src/services/InventoryService.test.js` 补充测试：覆盖 `useConsumable` 效果计算、hp/mp 上限约束、数量扣除
- [x] T016 [P] [US2] 编写 `server/src/services/InventoryService.test.js` 补充测试：覆盖 `equipItem` 部位替换、`unequipItem` 回背包检查、属性重算

### Implementation for User Story 2

- [x] T017 [US2] 实现 `server/src/services/InventoryService.js` 的 `useConsumable(characterId, playerItemId, quantity)`：解析 `consumable_effect`，计算实际效果（不超上限），扣除数量，通过 Socket.io 推送角色状态变更
- [x] T018 [US2] 实现 `server/src/services/InventoryService.js` 的 `equipItem(characterId, playerItemId)`：校验装备类型与部位，自动替换旧装备（旧装备回背包），触发角色属性重算
- [x] T019 [US2] 实现 `server/src/services/InventoryService.js` 的 `unequipItem(characterId, slot)`：校验部位非空，检查背包容量，将装备移回背包，触发角色属性重算
- [x] T020 [US2] 实现 `server/src/controllers/ItemController.js` 使用/穿戴/卸下接口并在 `server/src/routes/itemRoutes.js` / `server/src/index.js` 补充注册
- [x] T021 [US2] 在 `server/src/index.js` 中集成 Socket.io `characterUpdate` 事件推送：当角色属性因消耗品或装备变更时，向对应客户端广播最新 `Character` 数据

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - 管理道具配置 (Priority: P2)

**Goal**: 管理员可增删改查道具定义（ItemDefinition），修改装备属性后已穿戴该装备的玩家即时重算属性

**Independent Test**: 通过 Jest 单元测试验证 CRUD 校验与删除保护；通过 Supertest 验证管理接口权限与响应；验证修改后属性重算触发

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T022 [P] [US3] 编写 `server/src/services/ItemService.test.js`：覆盖 CRUD、参数校验、删除时玩家持有保护
- [x] T023 [P] [US3] 编写 `server/tests/integration/item-admin.integration.test.js`：覆盖 POST/PUT/DELETE /api/admin/items 端到端

### Implementation for User Story 3

- [x] T024 [US3] 实现 `server/src/services/ItemService.js` 完整 CRUD：创建/查询（支持分页筛选）/更新/删除；删除前校验无玩家持有；更新时校验 JSON 结构
- [x] T025 [US3] 实现管理员修改 `equipment_stats` 后的全服重算：在 `ItemService.update()` 中，若 `equipment_stats` 变更，遍历所有 `equip_*_id` 引用该 `ItemDefinition` 的 `Character` 记录，触发属性重算
- [x] T026 [US3] 实现 `server/src/controllers/ItemController.js` 管理接口（`GET/POST/PUT/DELETE /api/admin/items`）并在 `server/src/routes/itemRoutes.js` / `server/src/index.js` 补充注册

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 跨用户故事的收尾工作

- [x] T027 [P] 运行全部 Jest 测试套件（`npm test`），确保核心逻辑单元测试与集成测试全部通过
- [x] T028 人工 E2E 验收：按 `quickstart.md` 执行 Smoke Test，覆盖背包查询、道具获得、使用药水、穿戴装备、卸下装备、管理员创建道具、删除保护

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Consumes US1 的 `InventoryService` 骨架，但测试可独立运行
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - 完全独立，仅依赖 ItemDefinition 模型

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models before services（但在本项目中模型已在 Foundational 阶段完成）
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T003/T004/T005 (Phase 2 模型) 可并行
- T009/T010 (US1 测试) 可并行
- T015/T016 (US2 测试) 可并行
- T022/T023 (US3 测试) 可并行
- 三个 User Story 在 Foundational 完成后可并行开发（多开发人员场景）

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "编写 server/src/services/InventoryService.test.js 堆叠/获得/丢弃单元测试"
Task: "编写 server/tests/integration/inventory.integration.test.js 背包查询集成测试"

# Launch service implementation after tests are written:
Task: "实现 InventoryService.addItems 堆叠逻辑与满格检查"
Task: "实现 InventoryService.discardItem 部分丢弃与绑定保护"
Task: "实现 InventoryService.getInventory 筛选排序与容量统计"

# Final integration:
Task: "实现 ItemController 背包接口并注册路由"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational（模型与迁移）
3. Complete Phase 3: User Story 1（背包管理与道具流转）
4. **STOP and VALIDATE**: 独立测试 US1 —— 模拟玩家获得道具、堆叠、丢弃、查询背包
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo（MVP：玩家已有完整背包体验）
3. Add User Story 2 → Test independently → Deploy/Demo（增加消耗品与装备系统）
4. Add User Story 3 → Test independently → Deploy/Demo（增加管理后台）
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 + User Story 2（共享 InventoryService，天然连续）
   - Developer B: User Story 3（ItemService，与 US1/US2 无文件冲突）
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
