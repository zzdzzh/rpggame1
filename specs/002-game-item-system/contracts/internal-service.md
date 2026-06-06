# Contract: Internal Service Interface（模块间内部调用）

**Scope**: 本文件定义 002-game-item-system 暴露给同一进程内其他模块（主要是 001-game-quest-system）的编程接口。

**Pattern**: Service 层直接 `require`，非 HTTP / 消息队列。

---

## InventoryService.addItems(characterId, items)

为指定角色批量添加道具到背包。

**Module Consumer**: 001-game-quest-system（任务奖励发放）

**Signature**:
```javascript
/**
 * @param {number} characterId - 角色 ID
 * @param {Array<{item_definition_id: number, quantity: number, is_bound?: boolean}>} items
 * @returns {Promise<{success: boolean, added: Array, failed: Array}>}
 */
async addItems(characterId, items)
```

**Behavior**:
- 按 `items` 顺序依次尝试入库
- 优先堆叠到已有格子；无法堆叠则占新格
- 若任意一项导致背包溢出，默认**整单回滚**（所有 items 都不入库），返回 `success: false`
- 若全部成功，返回 `success: true` 及每行对应的 `player_item_id`

**Error Cases**:
- `CharacterNotFoundError` — 角色不存在
- `ItemDefinitionNotFoundError` — 某 item_definition_id 不存在
- `InventoryFullError` — 背包空间不足

---

## InventoryService.getEquippedItems(characterId)

获取角色当前穿戴的全部装备信息。

**Module Consumer**: 001-game-quest-system（可能用于角色信息展示或任务条件判断）

**Signature**:
```javascript
/**
 * @param {number} characterId
 * @returns {Promise<{weapon: PlayerItem|null, helmet: PlayerItem|null, armor: PlayerItem|null, accessory: PlayerItem|null}>}
 */
async getEquippedItems(characterId)
```

**Behavior**:
- 返回包含完整 `ItemDefinition` 嵌套信息的装备对象
- 若某部位未穿戴，对应值为 `null`

---

## InventoryService.hasItems(characterId, itemChecks)

检查角色是否持有指定道具及数量（用于任务系统的"收集"目标校验）。

**Module Consumer**: 001-game-quest-system（任务进度跟踪）

**Signature**:
```javascript
/**
 * @param {number} characterId
 * @param {Array<{item_definition_id: number, quantity: number}>} itemChecks
 * @returns {Promise<{allMet: boolean, details: Array<{item_definition_id, required, actual, met}>}>}
 */
async hasItems(characterId, itemChecks)
```

**Behavior**:
- 统计该角色所有 `PlayerItem` 中对应 `item_definition_id` 的 `quantity` 总和（跨格累加）
- `is_bound` 状态不影响校验（除非调用方显式要求）

---

## InventoryService.removeItems(characterId, items)

从角色背包中批量扣除道具（用于任务提交时的道具消耗、或合成系统）。

**Module Consumer**: 001-game-quest-system（可能的未来扩展：任务提交扣除收集品）

**Signature**:
```javascript
/**
 * @param {number} characterId
 * @param {Array<{item_definition_id: number, quantity: number}>} items
 * @returns {Promise<{success: boolean, removed: Array}>}
 */
async removeItems(characterId, items)
```

**Behavior**:
- 按 FIFO 原则从已有格子中扣除（优先扣除最早获得的格子）
- 若任意一项数量不足，默认整单回滚
- 扣除后 `quantity` 为 0 的 `PlayerItem` 记录自动删除

**Error Cases**:
- `ItemNotEnoughError` — 某道具持有数量不足
