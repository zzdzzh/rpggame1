# Contract: Quest Admin API（任务管理接口）

**Base Path**: `/api/admin/quests`
**Auth**: 依赖管理员认证中间件（假设 `req.isAdmin = true` 由上游认证注入）

---

## GET /api/admin/quests

查询任务配置列表（支持分页和条件筛选）。

**Query Parameters**:
| Param | Type | Required | Description |
|---|---|---|---|
| `quest_type` | string | no | 筛选：main / side / daily |
| `is_active` | boolean | no | 筛选上架状态 |
| `trigger_type` | string | no | 筛选触发类型：npc / location / event / auto |
| `trigger_target_id` | integer | no | 配合 trigger_type 使用 |
| `search` | string | no | 按任务名称模糊搜索 |
| `page` | integer | no | 页码，默认 1 |
| `page_size` | integer | no | 每页条数，默认 20，最大 100 |

**Response 200 OK**:
```json
{
  "total": 45,
  "page": 1,
  "page_size": 20,
  "quests": [
    {
      "quest_id": 1,
      "name": "初试锋芒",
      "description": "击杀5只史莱姆，证明你的实力。",
      "quest_type": "main",
      "level_min": 1,
      "level_max": 10,
      "is_active": true,
      "trigger_conditions": [
        { "trigger_type": "npc", "target_id": 101, "target_name": "村长" }
      ],
      "prerequisites": [],
      "objectives": [
        { "objective_id": "obj_1", "type": "kill", "target_id": 5, "target_name": "史莱姆", "required_amount": 5, "description": "击杀5只史莱姆" }
      ],
      "rewards": [
        { "reward_id": "reward_1", "type": "exp", "value": 100 },
        { "reward_id": "reward_2", "type": "gold", "value": 50 },
        { "reward_id": "reward_3", "type": "item", "item_definition_id": 5, "value": 3 }
      ],
      "max_concurrent_limit": 1,
      "player_count": 128,
      "created_at": "2026-06-01T08:00:00Z",
      "updated_at": "2026-06-05T10:00:00Z"
    }
  ]
}
```

**Behavior**:
- `player_count` 为当前已接取该任务的玩家数量（`PlayerQuest` 中该 `quest_id` 的记录数）
- 返回完整配置数据，包括 `objectives`、`rewards`、`trigger_conditions` 的原始 JSON

---

## GET /api/admin/quests/:questId

查询单个任务配置的详情。

**Path Parameters**:
| Param | Type | Description |
|---|---|---|
| `questId` | integer | 任务 ID |

**Response 200 OK**:
```json
{
  "quest_id": 1,
  "name": "初试锋芒",
  "description": "击杀5只史莱姆，证明你的实力。",
  "quest_type": "main",
  "level_min": 1,
  "level_max": 10,
  "is_active": true,
  "trigger_conditions": [
    { "trigger_type": "npc", "target_id": 101, "target_name": "村长" }
  ],
  "prerequisites": [],
  "objectives": [
    { "objective_id": "obj_1", "type": "kill", "target_id": 5, "target_name": "史莱姆", "required_amount": 5, "description": "击杀5只史莱姆" }
  ],
  "rewards": [
    { "reward_id": "reward_1", "type": "exp", "value": 100 },
    { "reward_id": "reward_2", "type": "gold", "value": 50 },
    { "reward_id": "reward_3", "type": "item", "item_definition_id": 5, "value": 3 }
  ],
  "max_concurrent_limit": 1,
  "player_count": 128,
  "created_at": "2026-06-01T08:00:00Z",
  "updated_at": "2026-06-05T10:00:00Z"
}
```

**Error Responses**:
- `404` — 任务不存在

---

## POST /api/admin/quests

创建新任务配置。

**Request Body**:
```json
{
  "name": "收集草药",
  "description": "为村长的药剂收集10株草药。",
  "quest_type": "side",
  "level_min": 1,
  "level_max": null,
  "trigger_conditions": [
    { "trigger_type": "npc", "target_id": 101, "target_name": "村长" }
  ],
  "prerequisites": [],
  "objectives": [
    { "objective_id": "obj_1", "type": "collect", "target_id": 10, "target_name": "草药", "required_amount": 10, "description": "收集10株草药" }
  ],
  "rewards": [
    { "reward_id": "reward_1", "type": "exp", "value": 50 },
    { "reward_id": "reward_2", "type": "gold", "value": 30 }
  ],
  "max_concurrent_limit": 1,
  "is_active": true
}
```

**Response 201 Created**:
```json
{
  "success": true,
  "quest_id": 10,
  "message": "任务创建成功"
}
```

**Error Responses**:
- `400` — 参数校验失败（如 objectives 为空 / rewards 中存在不存在的 item_definition_id / level_max < level_min）
- `409` — 任务名称已存在

---

## PUT /api/admin/quests/:questId

修改已有任务配置。

**Path Parameters**:
| Param | Type | Description |
|---|---|---|
| `questId` | integer | 任务 ID |

**Request Body**: 同 POST /api/admin/quests，所有字段可选，只更新提供的字段。

**Response 200 OK**:
```json
{
  "success": true,
  "quest_id": 10,
  "message": "任务更新成功"
}
```

**Error Responses**:
- `400` — 参数校验失败
- `404` — 任务不存在
- `409` — 任务名称与其他任务冲突

**Behavior Note**:
- 修改 `objectives`、`rewards`、`trigger_conditions`、`prerequisites` 等配置字段时，**已接取该任务的玩家进度不受影响**。
- 若需要修改已影响玩家的配置，应在管理端给出警告提示。
- 不允许修改 `quest_id`。

---

## DELETE /api/admin/quests/:questId

删除任务配置（仅当无人接取时允许删除）。

**Path Parameters**:
| Param | Type | Description |
|---|---|---|
| `questId` | integer | 任务 ID |

**Response 200 OK**:
```json
{
  "success": true,
  "message": "任务删除成功"
}
```

**Error Responses**:
- `400` — 该任务已被玩家接取，无法删除（建议先下架 `is_active = false`）
- `404` — 任务不存在

**Behavior Note**:
- 物理删除 `Quest` 记录，同时级联删除关联的 `PlayerQuest` 记录（但因为有前置校验，实际不会有 PlayerQuest 记录）。
- 更安全的替代方案是将 `is_active` 设为 `false`（下架）而非物理删除。

---

## POST /api/admin/quests/:questId/toggle

上架/下架任务（切换 `is_active` 状态）。

**Path Parameters**:
| Param | Type | Description |
|---|---|---|
| `questId` | integer | 任务 ID |

**Response 200 OK**:
```json
{
  "success": true,
  "quest_id": 10,
  "is_active": false,
  "message": "任务已下架"
}
```

**Error Responses**:
- `404` — 任务不存在

**Behavior Note**:
- 下架后，该任务不再出现在玩家的 `available` 查询列表中。
- 已接取该任务的玩家不受影响，仍可继续完成任务并领取奖励。
