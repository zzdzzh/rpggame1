# Data Model: 道具配置管理前台

**Feature**: 003-item-config-frontend
**Date**: 2026/06/07

---

## 说明

本模块为 **002-game-item-system** 的纯消费者，不拥有独立的持久化实体。所有数据模型直接来源于 002 的 `ItemDefinition` 实体及 Item Admin API 响应结构。

前台视角下，仅需维护：
1. **视图数据结构**：与 API 响应一致，不做额外转换
2. **表单状态结构**：用于创建/编辑时的双向绑定
3. **枚举映射**：前端展示用的中文标签映射表

---

## 实体消费关系

| Entity | Owner Module | Consumer Module | Consumption Pattern |
|--------|--------------|-----------------|---------------------|
| `ItemDefinition` | 002-game-item-system | 003-item-config-frontend | HTTP API 读取/写入（`specs/002-game-item-system/contracts/item-admin-api.md`） |
| `ConsumableEffect` | 002-game-item-system | 003-item-config-frontend | 嵌套在 ItemDefinition 中，通过表单编辑 |
| `EquipmentStats` | 002-game-item-system | 003-item-config-frontend | 嵌套在 ItemDefinition 中，通过表单编辑 |
| `EquipSlot` | 002-game-item-system | 003-item-config-frontend | 枚举值引用，用于表单下拉选项和列表展示 |

---

## 视图数据结构

### ItemDefinitionView（列表项 / 详情项）

与 002 `Item Admin API` 响应结构保持一致：

```typescript
interface ItemDefinitionView {
  item_definition_id: number;     // 唯一标识（创建时为 null/undefined）
  name: string;                    // 道具名称（必填，≤100字符）
  description?: string;            // 道具描述
  item_type: 'consumable' | 'equipment' | 'material' | 'quest';  // 道具类型（必填）
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'; // 品质（必填）
  icon?: string;                   // 图标标识符
  max_stack: number;               // 堆叠上限（必填，≥1）
  level_requirement?: number;      // 等级要求（默认0）
  is_bind_on_pickup?: boolean;     // 获得即绑定（默认false）
  consumable_effect?: ConsumableEffectView | null;  // 消耗品效果（item_type='consumable'时必填）
  equipment_stats?: EquipmentStatsView | null;       // 装备属性（item_type='equipment'时必填）
  equip_slot?: 'weapon' | 'helmet' | 'armor' | 'accessory' | null; // 装备部位（item_type='equipment'时必填）
  created_at?: string;             // ISO 8601 时间字符串
  updated_at?: string;             // ISO 8601 时间字符串
}
```

### ConsumableEffectView

```typescript
interface ConsumableEffectView {
  type: 'restore' | 'buff';        // 效果类型（必填）
  target: 'hp' | 'mp' | 'attack' | 'defense'; // 目标属性（必填）
  value: number;                   // 效果数值（必填，>0）
  duration_seconds?: number;       // 持续时间（秒）。type='restore'时为0，type='buff'时>0
}
```

### EquipmentStatsView

```typescript
interface EquipmentStatsView {
  attack?: number;        // 攻击力加成（允许0或正整数）
  defense?: number;       // 防御力加成（允许0或正整数）
  max_hp?: number;        // 生命上限加成（允许0或正整数）
  max_mp?: number;        // 魔法上限加成（允许0或正整数）
}
```

---

## 表单状态结构

### ItemFormState（Pinia Store 中的表单状态）

用于 `ItemForm.vue` 的双向绑定，结构与 `ItemDefinitionView` 基本一致，但增加 UI 控制字段：

```typescript
interface ItemFormState {
  // === 数据字段（与 ItemDefinitionView 一致） ===
  item_definition_id: number | null;
  name: string;
  description: string;
  item_type: string;
  rarity: string;
  icon: string;
  max_stack: number;
  level_requirement: number;
  is_bind_on_pickup: boolean;
  consumable_effect: ConsumableEffectView | null;
  equipment_stats: EquipmentStatsView | null;
  equip_slot: string | null;

  // === UI 控制字段 ===
  mode: 'create' | 'edit';         // 当前表单模式
  visible: boolean;                // 表单弹窗是否显示
  submitting: boolean;             // 是否正在提交
}
```

**初始值（创建模式）**:
```javascript
{
  item_definition_id: null,
  name: '',
  description: '',
  item_type: 'consumable',
  rarity: 'common',
  icon: '',
  max_stack: 99,
  level_requirement: 0,
  is_bind_on_pickup: false,
  consumable_effect: { type: 'restore', target: 'hp', value: 1, duration_seconds: 0 },
  equipment_stats: null,
  equip_slot: null,
  mode: 'create',
  visible: false,
  submitting: false
}
```

---

## 列表状态结构

### ItemListState（Pinia Store 中的列表状态）

```typescript
interface ItemListState {
  items: ItemDefinitionView[];     // 当前页数据
  total: number;                   // 总记录数
  page: number;                    // 当前页码（从1开始）
  page_size: number;               // 每页条数（默认20）
  loading: boolean;                // 列表加载中
  filters: {
    name?: string;                 // 名称关键词
    item_type?: string;            // 类型筛选
    rarity?: string;               // 品质筛选
  };
}
```

---

## 枚举映射表

前台展示用中文标签，必须与 002 定义的枚举值保持一致。

### 道具类型映射

| 编码值 | 中文标签 |
|--------|----------|
| `consumable` | 消耗品 |
| `equipment` | 装备 |
| `material` | 材料 |
| `quest` | 任务道具 |

### 品质映射

| 编码值 | 中文标签 |
|--------|----------|
| `common` | 普通 |
| `uncommon` | 优秀 |
| `rare` | 稀有 |
| `epic` | 史诗 |
| `legendary` | 传说 |

### 装备部位映射

| 编码值 | 中文标签 |
|--------|----------|
| `weapon` | 武器 |
| `helmet` | 头盔 |
| `armor` | 护甲 |
| `accessory` | 饰品 |

### 消耗品效果类型映射

| 编码值 | 中文标签 |
|--------|----------|
| `restore` | 恢复 |
| `buff` | 增益 |

### 效果目标属性映射

| 编码值 | 中文标签 |
|--------|----------|
| `hp` | 生命值 |
| `mp` | 魔法值 |
| `attack` | 攻击力 |
| `defense` | 防御力 |

---

## 校验规则（前台侧）

前台校验为体验优化，后端 002 做最终校验。

| 字段 | 规则 | 错误提示 |
|------|------|----------|
| `name` | 必填，长度 1~100 | "道具名称不能为空" / "道具名称不能超过100个字符" |
| `item_type` | 必填 | "请选择道具类型" |
| `rarity` | 必填 | "请选择品质" |
| `max_stack` | 必填，整数，≥1 | "堆叠上限必须大于等于1" |
| `level_requirement` | 整数，≥0 | "等级要求不能为负数" |
| `consumable_effect` | `item_type='consumable'` 时必填，且 `value > 0` | "请填写消耗品效果" / "效果数值必须大于0" |
| `equipment_stats` | `item_type='equipment'` 时必填（至少一项属性 > 0） | "请填写至少一项装备属性" |
| `equip_slot` | `item_type='equipment'` 时必填 | "请选择装备部位" |
