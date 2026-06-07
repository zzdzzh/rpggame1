# Contract: Quest API（玩家任务接口）

**Base Path**: `/api/quests`
**Auth**: 依赖现有玩家认证中间件（假设 `req.characterId` 由上游认证注入）

---

## GET /api/quests/available

查询当前角色可接取的任务列表。

**Query Parameters**:
| Param | Type | Required | Description |
|---|---|---|---|
| `trigger_type` | string | no | 筛选触发类型：npc / location / event / auto |
| `target_id` | integer | no | 配合 trigger_type 使用，如 NPC ID、地图 ID |
| `level` | integer | no | 当前角色等级（用于过滤 level_min/level_max） |
| `quest_type` | string | no | 筛选：main / side / daily |

**Response 200 OK**:
```json
{
  "character_id": 1,
  "count": 3,
  "quests": [
    {
      "quest_id": 1,
      "name": "初试锋芒",
      "description": "击杀5只史莱姆，证明你的实力。",
      "quest_type": "main",
      "level_min": 1,
      "level_max": 10,
      "trigger_conditions": [
        { "trigger_type": "npc", "target_id": 101, "target_name": "村长" }
      ],
      "objectives": [
        { "objective_id": "obj_1", "type": "kill", "target_name": "史莱姆", "required_amount": 5, "description": "击杀5只史莱姆" }
      ],
      "rewards_preview": [
        { "type": "exp", "value": 100 },
        { "type": "gold", "value": 50 },
        { "type": "item", "item_definition_id": 5, "item_name": "小型生命药水", "value": 3 }
      ]
    }
  ]
}
```

**Behavior**:
- 只返回 `is_active = true` 的任务
- 自动过滤掉该角色已接取、已完成或不符合等级/前置任务条件的任务
- 若提供了 `trigger_type` + `target_id`，进一步按触发点过滤
- `rewards_preview` 中的 `item_name` 从 `ItemDefinition` 表读取（跨模块查询）

---

## POST /api/quests/:questId/accept

接取指定任务。

**Path Parameters**:
| Param | Type | Description |
|---|---|---|
| `questId` | integer | 任务 ID |

**Response 200 OK**:
```json
{
  "success": true,
  "player_quest_id": 201,
  "status": "in_progress",
  "accepted_at": "2026-06-07T10:30:00Z",
  "quest": {
    "quest_id": 1,
    "name": "初试锋芒",
    "objectives": [
      { "objective_id": "obj_1", "type": "kill", "target_name": "史莱姆", "required_amount": 5, "description": "击杀5只史莱姆", "current_progress": 0 }
    ]
  }
}
```

**Error Responses**:
- `400` — 等级不足 / 前置任务未完成 / 已接取同类型互斥任务 / 同时接取任务数已达上限（20个）
- `404` — 任务不存在或已下架
- `409` — 该任务已接取或已完成（不可重复）

**Behavior Note**:
- 接取时若玩家已满足部分目标条件（如接取前已持有收集目标道具），系统**不**自动计入进度；进度从接取后开始计算（除非业务规则后续变更）。
- 接取成功后若目标为 "收集" 类型且玩家背包中已有该道具，下次背包变更事件触发时自动校验并更新进度。

---

## GET /api/quests/my

查询当前角色的任务列表。

**Query Parameters**:
| Param | Type | Required | Description |
|---|---|---|---|
| `status` | string | no | 筛选：accepted / in_progress / ready_for_reward / completed；不传则返回全部 |
| `quest_type` | string | no | 筛选：main / side / daily |

**Response 200 OK**:
```json
{
  "character_id": 1,
  "count": 5,
  "quests": [
    {
      "player_quest_id": 201,
      "quest_id": 1,
      "name": "初试锋芒",
      "quest_type": "main",
      "status": "in_progress",
      "progress": {
        "obj_1": { "current": 3, "required": 5, "is_completed": false }
      },
      "overall_progress_percent": 60,
      "accepted_at": "2026-06-07T10:30:00Z",
      "completed_at": null,
      "claimed_at": null
    },
    {
      "player_quest_id": 202,
      "quest_id": 2,
      "name": "收集草药",
      "quest_type": "side",
      "status": "ready_for_reward",
      "progress": {
        "obj_1": { "current": 10, "required": 10, "is_completed": true }
      },
      "overall_progress_percent": 100,
      "accepted_at": "2026-06-07T09:00:00Z",
      "completed_at": "2026-06-07T11:00:00Z",
      "claimed_at": null
    }
  ]
}
```

**Behavior**:
- `overall_progress_percent` 为所有目标进度的加权平均值
- 状态为 `ready_for_reward` 的任务在列表中置顶或加特殊标记，便于玩家识别

---

## POST /api/quests/:playerQuestId/submit

提交任务（在目标全部达成后）。

**Path Parameters**:
| Param | Type | Description |
|---|---|---|
| `playerQuestId` | integer | 玩家任务实例 ID |

**Response 200 OK**:
```json
{
  "success": true,
  "player_quest_id": 202,
  "status": "ready_for_reward",
  "completed_at": "2026-06-07T11:05:00Z",
  "message": "任务完成！请领取你的奖励。"
}
```

**Error Responses**:
- `400` — 任务进度未达 100%，不可提交
- `404` — 该 player_quest_id 不属于当前角色或不存在
- `409` — 任务状态不是 `in_progress`（已提交过或已领奖）

---

## POST /api/quests/:playerQuestId/claim

领取任务奖励。

**Path Parameters**:
| Param | Type | Description |
|---|---|---|
| `playerQuestId` | integer | 玩家任务实例 ID |

**Response 200 OK**:
```json
{
  "success": true,
  "player_quest_id": 202,
  "status": "completed",
  "claimed_at": "2026-06-07T11:10:00Z",
  "rewards": {
    "exp": 100,
    "gold": 50,
    "items": [
      { "item_definition_id": 5, "name": "小型生命药水", "quantity": 3, "player_item_id": 301 }
    ]
  },
  "character": {
    "character_id": 1,
    "exp": 350,
    "gold": 120,
    "level": 2
  }
}
```

**Error Responses**:
- `400` — 任务状态不是 `ready_for_reward` / 背包空间不足（道具奖励无法发放）
- `404` — 该 player_quest_id 不属于当前角色或不存在
- `409` — 奖励已被领取过

**Behavior Note**:
- 奖励发放为**事务性**操作：经验、货币、道具要么全部成功，要么全部失败。
- 道具奖励通过 `InventoryService.addItems` 发放；若返回 `InventoryFullError`，则整单回滚，任务保持 `ready_for_reward` 状态。
- `character` 字段返回最新的角色属性（经验、金币、等级），方便客户端直接刷新显示。

---

## WebSocket Event: `questUpdate`

当玩家任务进度发生变化时，服务端通过 Socket.io 主动推送。

**Event Name**: `questUpdate`
**Room**: `character:{character_id}`

**Payload**:
```json
{
  "player_quest_id": 201,
  "quest_id": 1,
  "status": "in_progress",
  "progress": {
    "obj_1": { "current": 4, "required": 5, "is_completed": false }
  },
  "overall_progress_percent": 80,
  "message": "任务进度更新：击杀史莱姆 4/5"
}
```

**触发时机**:
- 击杀怪物后，对应 "kill" 目标进度增加
- 收集道具后，对应 "collect" 目标进度增加（需监听背包变更事件）
- 到达指定地点后，对应 "reach" 目标进度更新
- 与 NPC 对话后，对应 "talk" 目标进度更新
- 当所有目标达成时，额外推送一条 `questReadyForReward` 事件（见下）

---

## WebSocket Event: `questReadyForReward`

当玩家任务所有目标达成，可以提交时推送。

**Event Name**: `questReadyForReward`
**Room**: `character:{character_id}`

**Payload**:
```json
{
  "player_quest_id": 201,
  "quest_id": 1,
  "name": "初试锋芒",
  "message": "任务目标已全部达成，可以提交任务了！"
}
```
