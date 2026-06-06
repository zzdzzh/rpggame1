# Contract: Inventory API（玩家背包接口）

**Base Path**: `/api/inventory`
**Auth**: 依赖现有玩家认证中间件（假设 `req.characterId` 由上游认证注入）

---

## GET /api/inventory

查询当前登录角色的背包列表。

**Query Parameters**:
| Param | Type | Required | Description |
|---|---|---|---|
| `item_type` | string | no | 筛选：consumable / equipment / material / quest |
| `sort_by` | string | no | 排序：acquired_at (默认) / name / rarity |
| `sort_order` | string | no | asc / desc (默认 desc) |

**Response 200 OK**:
```json
{
  "character_id": 1,
  "slots_used": 45,
  "slots_total": 200,
  "items": [
    {
      "player_item_id": 101,
      "item_definition_id": 5,
      "name": "小型生命药水",
      "icon": "potion_red_small",
      "item_type": "consumable",
      "rarity": "common",
      "quantity": 50,
      "max_stack": 99,
      "is_bound": false,
      "acquired_at": "2026-06-06T08:30:00Z"
    }
  ]
}
```

---

## POST /api/inventory/use

使用一个消耗品。

**Request Body**:
```json
{
  "player_item_id": 101,
  "quantity": 1
}
```

**Response 200 OK**:
```json
{
  "success": true,
  "effect": {
    "type": "restore",
    "target": "hp",
    "value": 30,
    "actual_value": 20,
    "reason": "capped_by_max_hp"
  },
  "character": {
    "character_id": 1,
    "hp": 100,
    "max_hp": 100
  },
  "remaining_quantity": 49,
  "player_item_id": 101
}
```

**Error Responses**:
- `400` — 该道具不是消耗品 / 数量不足 / 参数缺失
- `404` — 背包中不存在该道具

---

## POST /api/inventory/equip

穿戴一件装备。

**Request Body**:
```json
{
  "player_item_id": 205
}
```

**Response 200 OK**:
```json
{
  "success": true,
  "equipped_slot": "weapon",
  "previous_item": {
    "player_item_id": 201,
    "name": "铁剑"
  },
  "character": {
    "character_id": 1,
    "attack": 25,
    "defense": 5
  }
}
```

**Error Responses**:
- `400` — 该道具不是装备 / 等级不足 / 部位不匹配
- `409` — 该部位已有装备且客户端未确认替换（若设计为自动替换则返回 200 并带上 previous_item）
- `404` — 背包中不存在该道具

**Behavior Note**: 服务端默认执行自动替换。若该部位已有装备，旧装备卸下并回到背包（创建或恢复 PlayerItem 记录）。

---

## POST /api/inventory/unequip

卸下指定部位的装备。

**Request Body**:
```json
{
  "slot": "weapon"
}
```

**Response 200 OK**:
```json
{
  "success": true,
  "unequipped_item": {
    "player_item_id": 205,
    "name": "钢剑"
  },
  "character": {
    "character_id": 1,
    "attack": 10,
    "defense": 5
  }
}
```

**Error Responses**:
- `400` — 无效的部位名称 / 该部位当前无装备
- `409` — 背包已满，无法容纳卸下的装备

---

## POST /api/inventory/discard

丢弃道具（支持部分丢弃）。

**Request Body**:
```json
{
  "player_item_id": 101,
  "quantity": 3
}
```

**Response 200 OK**:
```json
{
  "success": true,
  "discarded_quantity": 3,
  "remaining_quantity": 2,
  "player_item_id": 101
}
```

**Error Responses**:
- `400` — 丢弃数量大于持有数量 / 已绑定道具不可丢弃
- `404` — 背包中不存在该道具

---

## POST /api/inventory/add (Internal)

为角色添加道具（主要用于 001 任务系统奖励发放，也可用于 GM 指令）。

**Request Body**:
```json
{
  "character_id": 1,
  "items": [
    { "item_definition_id": 5, "quantity": 5 },
    { "item_definition_id": 12, "quantity": 1, "is_bound": true }
  ]
}
```

**Response 200 OK**:
```json
{
  "success": true,
  "added": [
    { "item_definition_id": 5, "quantity": 5, "player_item_id": 110 },
    { "item_definition_id": 12, "quantity": 1, "player_item_id": 111 }
  ],
  "failed": []
}
```

**Error Responses**:
- `400` — 背包空间不足（部分或全部无法入库）
- `404` — 道具定义不存在 / 角色不存在

**Behavior Note**: 该接口设计为**事务性**——如果任意一个道具无法入库（如背包满），默认全部失败。若业务需要部分成功，可在 future version 中增加 `allow_partial` 参数。
