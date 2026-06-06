# Data Model: 游戏道具系统

**Feature**: 002-game-item-system
**Date**: 2026/06/06

---

## Entity Overview

```text
ItemDefinition (1) ───< (N) PlayerItem
    │
    │ 1:1 (via equip_*_id FKs on Character)
    ▼
Character (1) ───< (N) PlayerItem
```

---

## ItemDefinition（道具定义）

**Module Owner**: 002-game-item-system
**Consumed By**: 001-game-quest-system（任务奖励发放时读取奖励对应的 ItemDefinition）

道具的模板配置，由管理员维护。每种道具在游戏中唯一对应一条记录。

| Field | Type | Constraints | Description |
|---|---|---|---|
| `item_definition_id` | INTEGER | PK, autoIncrement | 道具定义唯一标识 |
| `name` | STRING(100) | NOT NULL | 道具名称 |
| `description` | TEXT | | 道具描述 |
| `item_type` | ENUM | NOT NULL, values: `consumable`/`equipment`/`material`/`quest` | 道具类型 |
| `rarity` | ENUM | NOT NULL, values: `common`/`uncommon`/`rare`/`epic`/`legendary` | 品质 |
| `icon` | STRING(255) | | 图标标识符（客户端资源映射） |
| `max_stack` | INTEGER | NOT NULL, default: 1 | 单格堆叠上限（装备通常为1，消耗品通常为99） |
| `level_requirement` | INTEGER | default: 0 | 使用/穿戴等级要求 |
| `is_bind_on_pickup` | BOOLEAN | default: false | 获得即绑定 |
| `consumable_effect` | JSON | | 消耗品效果（仅 `item_type='consumable'` 时有效）。结构示例：`{"type": "restore", "target": "hp", "value": 30}` |
| `equipment_stats` | JSON | | 装备属性（仅 `item_type='equipment'` 时有效）。结构示例：`{"attack": 15, "defense": 5, "max_hp": 20}` |
| `equip_slot` | ENUM | values: `weapon`/`helmet`/`armor`/`accessory`/`null` | 装备部位（仅装备类有效） |
| `created_at` | DATE | auto | |
| `updated_at` | DATE | auto | |

**Validation Rules**:
- `item_type='consumable'` 时，`consumable_effect` 必须非空且包含 `type`/`target`/`value` 字段
- `item_type='equipment'` 时，`equipment_stats` 和 `equip_slot` 必须非空
- `max_stack` ≥ 1；装备类 `max_stack` 强制为 1

**State Transitions**: 无复杂状态机；管理端增删改查直接操作。

---

## PlayerItem（玩家背包道具）

**Module Owner**: 002-game-item-system
**Consumed By**: 001-game-quest-system（任务奖励发放时调用 InventoryService 创建 PlayerItem 记录）

玩家背包中的实际道具实例，每一格对应一条记录（即使数量为0也不会保留，自动清理）。

| Field | Type | Constraints | Description |
|---|---|---|---|
| `player_item_id` | INTEGER | PK, autoIncrement | 背包格唯一标识 |
| `character_id` | INTEGER | NOT NULL, FK → Character.character_id | 所属角色 |
| `item_definition_id` | INTEGER | NOT NULL, FK → ItemDefinition.item_definition_id | 道具定义 |
| `quantity` | INTEGER | NOT NULL, default: 1, ≥1 | 当前数量 |
| `is_bound` | BOOLEAN | default: false | 是否已绑定 |
| `acquired_at` | DATE | default: NOW | 获得时间 |
| `created_at` | DATE | auto | |
| `updated_at` | DATE | auto | |

**Validation Rules**:
- `(character_id, item_definition_id, is_bound)` 组合在可堆叠场景下**不唯一**——同一玩家同一道具可分散在多格（如 150 个药水，堆叠上限 99，则占 2 格：99+51）
- `quantity` ≤ 对应 `ItemDefinition.max_stack`
- 当 `quantity` 被更新为 0 时，记录必须被物理删除（背包格释放）

**State Transitions**:
```
[获得道具] → PlayerItem 创建（或已有记录 quantity 增加）
[使用/丢弃] → quantity 减少；若 quantity=0 → 记录删除
[绑定] → is_bound 从 false 变为 true（不可逆）
[装备] → 不修改 PlayerItem 记录；通过 Character 上的 equip_*_id 外键引用
[卸下] → Character.equip_*_id 设为 NULL；PlayerItem 记录保留在背包中
```

---

## Character（角色）— 本模块扩展字段

**Module Owner**: 001-game-quest-system / 核心角色系统（由既有系统维护）
**Consumed By**: 002-game-item-system（穿戴装备时需要读写装备槽位字段；使用消耗品时需要读写 hp/mp/attack/defense）

在现有 `Character` 模型基础上增加以下字段：

| Field | Type | Constraints | Description |
|---|---|---|---|
| `equip_weapon_id` | INTEGER | FK → PlayerItem.player_item_id, nullable | 当前穿戴的武器 |
| `equip_helmet_id` | INTEGER | FK → PlayerItem.player_item_id, nullable | 当前穿戴的头盔 |
| `equip_armor_id` | INTEGER | FK → PlayerItem.player_item_id, nullable | 当前穿戴的护甲 |
| `equip_accessory_id` | INTEGER | FK → PlayerItem.player_item_id, nullable | 当前穿戴的饰品 |

**Validation Rules**:
- 装备槽位引用的 `PlayerItem` 必须属于该 `Character`（同一角色不能穿戴其他角色的道具）
- 装备槽位引用的 `PlayerItem` 对应的 `ItemDefinition.item_type` 必须为 `equipment`
- `equip_*_id` 对应的 `ItemDefinition.equip_slot` 必须与字段名匹配（如 `equip_weapon_id` 对应的道具 `equip_slot` 必须是 `weapon`）

**State Transitions**:
```
[穿戴装备] → 对应 equip_*_id 更新为新 PlayerItem ID；原装备 ID（若有）被替换并回背包
[卸下装备] → 对应 equip_*_id 设为 NULL
```

**Attribute Recalculation Rule**:
角色面板属性 = 基础属性（Character 表原始值） + SUM(所有已穿戴装备的 `equipment_stats` 加成)
- 每次穿戴/卸下/管理员修改装备属性定义时触发重算
- 重算后同步更新 `Character.hp`/`max_hp`/`mp`/`max_mp`/`attack`/`defense` 等字段（确保 hp 不超过新的 max_hp）

---

## EquipSlot（装备部位枚举）

**Module Owner**: 002-game-item-system
**Note**: 不作为独立数据库表，以 Sequelize ENUM 或代码常量形式存在。

| Value | Description |
|---|---|
| `weapon` | 武器 |
| `helmet` | 头盔 |
| `armor` | 护甲 |
| `accessory` | 饰品 |

---

## ConsumableEffect Schema（JSON 结构约束）

**Module Owner**: 002-game-item-system

```json
{
  "type": "restore",       // Enum: "restore" | "buff"
  "target": "hp",          // Enum: "hp" | "mp" | "attack" | "defense"
  "value": 30,             // Integer, > 0
  "duration_seconds": 0    // Integer, ≥ 0；type="restore" 时为 0，type="buff" 时 > 0
}
```

**Validation**:
- `type='restore'` 时：`duration_seconds` 必须为 0；效果立即应用到当前值（受上限约束）
- `type='buff'` 时：`duration_seconds` > 0；效果在持续时间内附加到面板属性，到期后移除
- V1 版本中暂不支持多个 effect 的数组，仅支持单条 effect

---

## EquipmentStats Schema（JSON 结构约束）

**Module Owner**: 002-game-item-system

```json
{
  "attack": 15,
  "defense": 5,
  "max_hp": 20,
  "max_mp": 0
}
```

**Validation**:
- 所有属性值为 Integer，允许为 0 或正数
- 不允许负值（避免装备降级面板）
- 未指定的属性视为 0

---

## Cross-Module Entity Consumption

| Entity | Owner Module | Consumer Module | Consumption Pattern |
|---|---|---|---|
| `ItemDefinition` | 002 | 001 | 001 读取 `item_definition_id`、名称、图标等信息用于任务奖励展示 |
| `PlayerItem` | 002 | 001 | 001 通过 `InventoryService.addItems(characterId, [{item_definition_id, quantity}])` 创建 PlayerItem 记录，实现任务奖励发放 |
| `Character.equip_*_id` | 002（扩展字段） | 001 | 001 可能在展示角色信息时需要读取装备状态，但只读不写入 |

**反向依赖检查**: 002 不消费 001 的任何实体或服务。002 的假设中提到 "对接任务系统"，但实现上 002 仅暴露服务接口供 001 调用，不反向依赖 001。
