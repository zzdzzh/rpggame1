# Data Model: 游戏任务系统

**Feature**: 001-game-quest-system
**Date**: 2026/06/07

---

## Entity Overview

```text
Quest (1) ───< (N) PlayerQuest

Character (1) ───< (N) PlayerQuest
```

---

## Quest（任务定义）

**Module Owner**: 001-game-quest-system
**Consumed By**: 前台（展示任务信息）

游戏中的任务模板配置，由管理员维护。每条记录代表一个可接取的任务。

| Field | Type | Constraints | Description |
|---|---|---|---|
| `quest_id` | INTEGER | PK, autoIncrement | 任务唯一标识 |
| `name` | STRING(100) | NOT NULL | 任务名称 |
| `description` | TEXT | | 任务描述 |
| `quest_type` | ENUM | NOT NULL, values: `main`/`side`/`daily` | 任务类型 |
| `level_min` | INTEGER | NOT NULL, default: 1 | 最低等级要求 |
| `level_max` | INTEGER | nullable | 最高等级限制（null 表示无上限） |
| `trigger_conditions_json` | JSON | NOT NULL | 触发条件数组，见下方 QuestTrigger Schema |
| `prerequisites_json` | JSON | NOT NULL, default: `[]` | 前置任务 ID 数组，如 `[1, 2]` |
| `objectives_json` | JSON | NOT NULL | 任务目标数组，见下方 QuestObjective Schema |
| `rewards_json` | JSON | NOT NULL | 任务奖励数组，见下方 QuestReward Schema |
| `max_concurrent_limit` | INTEGER | NOT NULL, default: 1 | 同类型互斥数量（1 = 不可重复接取） |
| `is_active` | BOOLEAN | NOT NULL, default: true | 是否上架（管理员下架后不可接取） |
| `created_at` | DATE | auto | |
| `updated_at` | DATE | auto | |

**Validation Rules**:
- `name` 全局唯一（同一游戏内任务名称不可重复）
- `level_min` ≥ 1；若 `level_max` 非 null，则 `level_max` ≥ `level_min`
- `objectives_json` 至少包含 1 个目标
- `rewards_json` 可为空数组（表示无物质奖励，仅剧情任务）
- 管理端修改 `objectives_json` 或 `rewards_json` 时，已接取该任务的玩家进度**不受影响**（仅影响新接取的玩家）

**State Transitions**: 无复杂状态机；`is_active` 由管理员直接切换。

---

## PlayerQuest（玩家任务实例）

**Module Owner**: 001-game-quest-system
**Consumed By**: 前台（展示玩家任务状态）

记录某位玩家与某个任务之间的关联实例，包含进度和状态。

| Field | Type | Constraints | Description |
|---|---|---|---|
| `player_quest_id` | INTEGER | PK, autoIncrement | 实例唯一标识 |
| `character_id` | INTEGER | NOT NULL, FK → Character.character_id | 所属角色 |
| `quest_id` | INTEGER | NOT NULL, FK → Quest.quest_id | 关联任务定义 |
| `status` | ENUM | NOT NULL, values: `accepted`/`in_progress`/`ready_for_reward`/`completed` | 当前状态 |
| `progress_json` | JSON | NOT NULL, default: `{}` | 各目标当前进度，见下方 Progress Schema |
| `accepted_at` | DATE | NOT NULL, default: NOW | 接取时间 |
| `completed_at` | DATE | nullable | 提交完成时间（status 变为 ready_for_reward 时记录） |
| `claimed_at` | DATE | nullable | 领奖时间（status 变为 completed 时记录） |
| `created_at` | DATE | auto | |
| `updated_at` | DATE | auto | |

**Validation Rules**:
- `(character_id, quest_id)` 组合唯一（同一角色不能重复接取同一任务）
- `status` 转换必须通过显式 Service 函数，禁止直接非法赋值
- 当 `status` = `completed` 时，`claimed_at` 必须非 null
- 角色同时存在的 `PlayerQuest` 记录数（status ≠ `completed`）≤ 20

**State Transitions**:
```
[接取任务] → status: accepted
  ↓ 系统自动根据进度推进
[进度 > 0 且 < 100%] → status: in_progress
  ↓ 所有目标达成
[所有目标达成] → status: ready_for_reward, completed_at = NOW
  ↓ 玩家领取奖励
[领取奖励] → status: completed, claimed_at = NOW
```

---

## QuestObjective Schema（JSON 结构约束）

**Module Owner**: 001-game-quest-system

`Quest.objectives_json` 为数组，每项结构如下：

```json
{
  "objective_id": "obj_1",      // String, 目标在任务内的唯一标识
  "type": "kill",               // Enum: "kill" | "collect" | "reach" | "talk"
  "target_id": 5,               // Integer, 目标实体 ID（怪物定义 ID / 道具定义 ID / NPC ID / 地图 ID）
  "target_name": "史莱姆",       // String, 展示用名称
  "required_amount": 5,         // Integer, > 0, 需要达成的数量
  "description": "击杀5只史莱姆"  // String, 玩家可见描述
}
```

**Validation**:
- `type` 必须在允许列表内（V1: kill, collect, reach, talk）
- `required_amount` ≥ 1
- 同一 `objectives_json` 数组内 `objective_id` 不可重复
- `type='collect'` 时，`target_id` 对应 `ItemDefinition.item_definition_id`
- `type='kill'` 时，`target_id` 对应怪物定义 ID（需与现有 Character 表中怪物数据对齐）
- `type='reach'` 时，`target_id` 对应地图/区域 ID
- `type='talk'` 时，`target_id` 对应 NPC ID

---

## QuestReward Schema（JSON 结构约束）

**Module Owner**: 001-game-quest-system

`Quest.rewards_json` 为数组，每项结构如下：

```json
{
  "reward_id": "reward_1",      // String, 奖励在任务内的唯一标识
  "type": "exp",                // Enum: "exp" | "gold" | "item"
  "value": 100,                 // Integer, > 0；type='item' 时代表数量
  "item_definition_id": null    // Integer, 仅 type='item' 时必填，对应 ItemDefinition.item_definition_id
}
```

**Validation**:
- `type` 必须在允许列表内（V1: exp, gold, item）
- `type='item'` 时，`item_definition_id` 必须非 null 且存在于 `ItemDefinition` 表
- `type='exp'` / `type='gold'` 时，`item_definition_id` 必须为 null
- `value` ≥ 1

---

## QuestTrigger Schema（JSON 结构约束）

**Module Owner**: 001-game-quest-system

`Quest.trigger_conditions_json` 为数组，各项为 OR 关系（满足任意一项即可接取）。每项结构如下：

```json
{
  "trigger_type": "npc",        // Enum: "npc" | "location" | "event" | "level" | "auto"
  "target_id": 101,             // Integer, NPC ID / 地图 ID / 事件 ID；trigger_type='level'/'auto' 时为 null
  "target_name": "村长",         // String, 展示用名称
  "min_level": 1                // Integer, 仅 trigger_type='level' 时有效
}
```

**Validation**:
- `trigger_type` 必须在允许列表内
- `trigger_type='npc'` 时，`target_id` 对应 NPC ID
- `trigger_type='location'` 时，`target_id` 对应地图/区域 ID
- `trigger_type='event'` 时，`target_id` 对应事件 ID
- `trigger_type='level'` 时，`min_level` ≥ 1，`target_id` 可忽略
- `trigger_type='auto'` 时，表示达到条件后自动出现在任务列表（无需主动触发）

---

## Progress Schema（玩家任务进度 JSON）

**Module Owner**: 001-game-quest-system

`PlayerQuest.progress_json` 结构为键值对，键为 `objective_id`，值为当前进度：

```json
{
  "obj_1": 3,   // 当前已击杀 3/5 只史莱姆
  "obj_2": 0    // 尚未完成的目标
}
```

**Validation**:
- 键必须对应 `Quest.objectives_json` 中某项的 `objective_id`
- 值必须 ≥ 0 且 ≤ 对应 `objective` 的 `required_amount`
- 当某目标 `value` = `required_amount` 时，视为该目标达成

---

## Cross-Module Entity Consumption

| Entity | Owner Module | Consumer Module | Consumption Pattern |
|---|---|---|---|
| `ItemDefinition` | 002 | 001 | 001 读取 `item_definition_id`、名称、图标等信息用于任务奖励展示 |
| `PlayerItem` | 002 | 001 | 001 通过 `InventoryService.addItems(characterId, [{item_definition_id, quantity}])` 创建 PlayerItem 记录，实现任务奖励发放 |
| `Character` | 核心角色系统 | 001 | 001 读取 `level`、已接任务列表，写入 `exp`/`gold`（经验/货币奖励） |
| `InventoryService.addItems` | 002 | 001 | Service 层直接 require，发放道具奖励 |
| `InventoryService.hasItems` | 002 | 001 | Service 层直接 require，校验收集类目标是否达成 |

**反向依赖检查**: 002 不消费 001 的任何实体或服务。符合模块边界纪律 "反向依赖禁令"。

---

## 索引设计

| 表 | 字段 | 类型 | 理由 |
|---|---|---|---|
| Quest | `is_active` | 普通索引 | 可接任务查询需过滤上架状态 |
| Quest | `quest_type` | 普通索引 | 按类型筛选 |
| PlayerQuest | `(character_id, status)` | 复合索引 | 查询玩家当前进行中/待领奖任务 |
| PlayerQuest | `(character_id, quest_id)` | 唯一索引 | 防止重复接取 |
