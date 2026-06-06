# Contract: Item Admin API（道具定义管理接口）

**Base Path**: `/api/admin/items`
**Auth**: 假设由上游管理员认证中间件保护（不在本模块内实现）

---

## GET /api/admin/items

查询道具定义列表（支持筛选与分页）。

**Query Parameters**:
| Param | Type | Required | Description |
|---|---|---|---|
| `name` | string | no | 名称模糊匹配 |
| `item_type` | string | no | consumable / equipment / material / quest |
| `rarity` | string | no | common / uncommon / rare / epic / legendary |
| `page` | integer | no | 默认 1 |
| `page_size` | integer | no | 默认 20，最大 100 |

**Response 200 OK**:
```json
{
  "total": 156,
  "page": 1,
  "page_size": 20,
  "items": [
    {
      "item_definition_id": 5,
      "name": "小型生命药水",
      "item_type": "consumable",
      "rarity": "common",
      "icon": "potion_red_small",
      "max_stack": 99,
      "level_requirement": 0,
      "consumable_effect": { "type": "restore", "target": "hp", "value": 30 },
      "equipment_stats": null,
      "equip_slot": null,
      "created_at": "2026-06-01T10:00:00Z"
    }
  ]
}
```

---

## GET /api/admin/items/:id

查询单个道具定义详情。

**Response 200 OK**:
```json
{
  "item_definition_id": 5,
  "name": "小型生命药水",
  "description": "恢复30点生命值",
  "item_type": "consumable",
  "rarity": "common",
  "icon": "potion_red_small",
  "max_stack": 99,
  "level_requirement": 0,
  "is_bind_on_pickup": false,
  "consumable_effect": { "type": "restore", "target": "hp", "value": 30 },
  "equipment_stats": null,
  "equip_slot": null,
  "created_at": "2026-06-01T10:00:00Z",
  "updated_at": "2026-06-06T12:00:00Z"
}
```

**Error Responses**:
- `404` — 道具定义不存在

---

## POST /api/admin/items

创建新道具定义。

**Request Body**:
```json
{
  "name": "钢剑",
  "description": "由精钢锻造的剑，攻击力中等",
  "item_type": "equipment",
  "rarity": "uncommon",
  "icon": "sword_steel",
  "max_stack": 1,
  "level_requirement": 5,
  "is_bind_on_pickup": false,
  "equipment_stats": { "attack": 15, "defense": 0 },
  "equip_slot": "weapon",
  "consumable_effect": null
}
```

**Response 201 Created**:
```json
{
  "item_definition_id": 42,
  "name": "钢剑",
  ...
}
```

**Error Responses**:
- `400` — 参数校验失败（如 equipment 类型缺少 equip_slot / equipment_stats）
- `409` — 名称重复（若业务要求唯一）

---

## PUT /api/admin/items/:id

修改道具定义。

**Request Body**: 同 POST，字段全量或部分更新（视实现而定，建议全量替换以避免 PATCH 复杂度）。

**Response 200 OK**:
```json
{
  "item_definition_id": 42,
  "name": "钢剑+1",
  ...
}
```

**Behavior Note**: 修改 `equipment_stats` 后，系统必须遍历所有已穿戴该装备的 Character，触发属性重算。

**Error Responses**:
- `400` — 参数校验失败
- `404` — 道具定义不存在

---

## DELETE /api/admin/items/:id

删除道具定义。

**Response 204 No Content**

**Error Responses**:
- `400` — 该道具定义已被玩家持有（PlayerItem 中存在关联记录），不可删除
- `404` — 道具定义不存在

**Behavior Note**: 硬删除。若未来需要审计，可改为软删除（增加 `is_deleted` 字段），但 V1 按简化原则直接硬删除，前提是校验无玩家持有。
