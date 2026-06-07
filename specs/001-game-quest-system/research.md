# Research: 游戏任务系统技术决策

**Feature**: 001-game-quest-system
**Date**: 2026/06/07

---

## Decision 1: 复用 002 已确定的数据库与 ORM 方案

**Decision**: 使用 `sqlite3` npm 包 + Sequelize 6.x，数据库文件 `server/data/game.db`。零新增数据库依赖。
、
**Rationale**:
- Constitution 明确要求 "数据库采用sqlite，但不要用编译版本，直接用js的版本即可"。
- 002 模块已完成 `sqlite3` + Sequelize 的选型、配置和迁移验证，001 直接复用成本最低。
- 现有 `server/src/config/sequelize.js` 和 `server/src/config/database.js` 已支持 SQLite dialect，新增模型只需按 Sequelize 规范定义即可。
- 无需重新评估 `better-sqlite3` / `sql.js` / MySQL 等替代方案。

**Alternatives considered**: 无；002 的 research.md 已充分论证并排除了所有替代方案。

**Impact**:
- `server/package.json` 不新增任何数据库相关依赖。
- 新增 Sequelize 迁移文件遵循现有 `server/src/migrations/` 命名和格式规范。

---

## Decision 2: 模块间奖励发放采用 Service 层直接调用（复用 002 Decision 3）

**Decision**: 001 任务系统在发放道具奖励时，直接 `require` 002 模块的 `InventoryService.addItems(characterId, items)` 方法。不通过 HTTP 内部调用，也不引入消息队列。

**Rationale**:
- 002 的 research.md Decision 3 已详细论证此方案。两个模块位于同一 Node.js 进程内，Service 层直接调用是最简单、性能最高的方式。
- Constitution 简单优先原则明确反对引入当前阶段不需要的运行时组件。
- 直接调用意味着 001 对 002 存在编译时/加载时依赖，符合模块边界纪律中的 "显式申报" 要求——已在 data-model.md 和 contracts/ 中标注。

**Alternatives considered**:
- 内部 REST API 调用：同一进程内无意义，增加网络开销；否决。
- EventEmitter / 消息队列：解耦更好，但本项目规模下过度设计；否决。

**Impact**:
- 002 的 `InventoryService.js` 必须导出稳定的方法签名供 001 消费。
- 任何对 `addItems` / `hasItems` / `removeItems` 签名的变更，必须同步检查 001 模块的调用方（模块边界纪律）。
- 若 001 需要新增对 002 接口的消费（如查询背包空间），必须在 002 的 contracts/internal-service.md 中增补接口定义，不能在 001 中绕过。

---

## Decision 3: 任务目标与奖励配置采用 JSON 字段存储（对齐 002 Decision 5）

**Decision**: `Quest` 模型中使用 `DataTypes.JSON` 存储 `objectives` 和 `rewards`，而非拆分为独立的 `QuestObjective` / `QuestReward` 关联表。触发条件同理以 JSON 存储。

**Rationale**:
- V1 版本目标类型仅 4 种（击杀、收集、到达、对话），结构简单且固定。JSON 字段足以表达，避免了 2-3 个额外的关联表和 JOIN 查询。
- 002 模块的 `ItemDefinition` 已采用 JSON 字段存储 `consumable_effect` 和 `equipment_stats`，001 采用相同模式可保持项目内设计一致性。
- Sequelize + SQLite 对 JSON 字段支持良好（SQLite 3.38+ 原生支持 JSON，Sequelize 会自动处理）。
- 管理端增删改查时，前端直接提交 JSON 对象，无需复杂的多表事务。
- 假设 "活跃任务定义不超过 1 万条"，JSON 查询性能不会成为瓶颈。

**Alternatives considered**:
- 独立表 `QuestObjectives` / `QuestRewards` / `QuestTriggers`：范式更规范，支持复杂查询；否决，当前场景下查询通常按 Quest 维度进行，且简单优先。
- 混合方案（主表 + 独立表）：增加复杂度，无明确收益；否决。

**Impact**:
- `Quest` 模型包含 `objectives_json`、`rewards_json`、`trigger_conditions_json` 三个 JSON 字段。
- 服务端在解析目标/奖励时需做基础校验（如 `objective.type` 必须在允许列表内）。
- 若未来需要 "查询所有奖励包含某道具的任务" 等反向查询，JSON 字段性能劣于独立表；当前无此需求，如未来出现可再评估。

---

## Decision 4: 实时进度推送复用现有 Socket.io 通道

**Decision**: 任务进度更新（如击杀怪物、收集道具）通过 Socket.io `io.to(characterId).emit('questUpdate', { playerQuestId, progress })` 推送给客户端。不新建 WebSocket 服务或轮询机制。

**Rationale**:
- 现有 `server/src/index.js` 已初始化 Socket.io 并用于位置广播（`positionsUpdate`），复用现有通道成本最低。
- 任务进度更新频率低（仅在目标达成时推送，非持续推送），对 Socket.io 性能无压力。
- 若仅依赖 REST 响应，客户端需要手动处理响应并更新状态；Socket.io 推送可确保多端状态同步。

**Alternatives considered**:
- 纯 REST，客户端轮询：增加不必要的请求和延迟；否决。
- 新增独立的 WebSocket 服务：过度设计；否决。

**Impact**:
- `QuestProgressService` 中需引用 `io` 实例（通过依赖注入或 module.exports 解耦，与 002 InventoryService 保持一致）。
- 客户端需新增 `questUpdate` 事件监听，更新本地 Pinia store 中的任务状态。

---

## Decision 5: 任务状态机采用枚举字段 + 显式状态转换函数

**Decision**: `PlayerQuest.status` 使用 Sequelize ENUM，值为 `accepted` / `in_progress` / `ready_for_reward` / `completed`。状态转换通过 `QuestProgressService` / `QuestRewardService` 中的显式函数控制，禁止直接赋值。

**Rationale**:
- 任务状态转换路径固定且有限（接取→进行中→待领奖→已完成），适合状态机模式。
- ENUM 在 SQLite 中由 Sequelize 以 TEXT + CHECK 约束模拟，足够安全。
- 显式转换函数可在同一处集中校验转换合法性（如 "待领奖" 不能直接回到 "进行中"），避免散落在各控制器中。

**Alternatives considered**:
- 字符串字段 + 代码校验：无数据库层约束，容易出错；否决。
- 独立状态历史表：记录完整状态流转历史；否决，V1 无审计需求，过度设计。

**Impact**:
- `PlayerQuest` 模型定义 `status` 为 ENUM。
- `QuestProgressService` 提供 `updateProgress()`、`submitQuest()`；`QuestRewardService` 提供 `claimReward()`。
- 如需扩展状态（如 `abandoned` 放弃），需修改 ENUM 定义 + 所有状态转换函数。

---

## Decision 6: 任务查询条件在内存中过滤（基于规模假设）

**Decision**: 可接任务查询（按触发点、等级、前置任务等条件过滤）先读取该玩家已接/已完成任务列表，再与任务定义表做内存过滤。不建立复杂的数据库复合索引或全文检索。

**Rationale**:
- 假设 "活跃任务定义不超过 1 万条"，且玩家同时可接取上限仅 20 个，内存过滤在 Node.js 中单次查询耗时在毫秒级，远低于 3 秒目标。
- 前置任务、互斥任务等条件涉及多表关联和递归检查，纯 SQL 表达复杂且难以维护；内存过滤逻辑直观，便于单元测试。
- Constitution 简单优先，避免为假设中的性能问题过早引入 Redis、Elasticsearch 等外部索引。

**Alternatives considered**:
- 数据库复合索引 + 纯 SQL 过滤：查询条件动态组合（触发点、等级、类型、前置任务），索引设计困难且收益有限；否决。
- Redis 缓存可接任务列表：增加外部依赖，当前规模下无必要；否决。

**Impact**:
- `QuestService.getAvailableQuests(characterId, trigger)` 实现为：先查 `PlayerQuest` 获取该玩家已有任务，再查全量 `Quest` 定义，最后内存过滤。
- 若未来任务规模突破 1 万条或查询成为瓶颈，可再评估引入 Redis 缓存或数据库索引优化。

---

## Cross-Module Dependency Summary

| 001 消费 002 的内容 | 来源文件 | 消费方式 | 约束 |
|---|---|---|---|
| `ItemDefinition` 实体 | `002/data-model.md` | 只读（展示奖励信息） | 不可修改 002 表结构 |
| `PlayerItem` 实体 | `002/data-model.md` | 通过 `InventoryService.addItems` 创建 | 不可直接写入 002 表 |
| `InventoryService.addItems` | `002/contracts/internal-service.md` | Service 层直接 require | 签名变更需同步通知 001 |
| `InventoryService.hasItems` | `002/contracts/internal-service.md` | Service 层直接 require | 用于收集类目标校验 |
| `InventoryService.removeItems` | `002/contracts/internal-service.md` | Service 层直接 require | 用于任务提交扣除收集品（预留） |

**反向依赖检查**: 002 不消费 001 的任何实体或服务。符合模块边界纪律 "反向依赖禁令"。
