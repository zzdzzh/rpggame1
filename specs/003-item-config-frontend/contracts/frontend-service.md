# Contract: 前台 Item Admin Service 封装

**Module**: 003-item-config-frontend
**Depends On**: 002-game-item-system / `specs/002-game-item-system/contracts/item-admin-api.md`

---

## 说明

本文件定义前台 `client/src/services/itemAdminService.js` 模块的公共接口。该模块是对 002 Item Admin API 的薄封装，不做业务逻辑处理，仅负责 HTTP 请求发送、响应解析和错误抛出。

---

## itemAdminService.list(params)

查询道具定义列表（支持筛选与分页）。

**Signature**:
```javascript
/**
 * @param {Object} params
 * @param {string} [params.name] - 名称关键词（模糊匹配）
 * @param {string} [params.item_type] - consumable / equipment / material / quest
 * @param {string} [params.rarity] - common / uncommon / rare / epic / legendary
 * @param {number} [params.page=1] - 页码
 * @param {number} [params.page_size=20] - 每页条数
 * @returns {Promise<{total: number, page: number, page_size: number, items: Array<ItemDefinitionView>}>}
 */
async function list(params)
```

**Behavior**:
- 调用 `GET /api/admin/items`
- 将前端 camelCase 参数名映射为后端 snake_case Query Parameters
- 空值参数自动过滤，不发送到后端

---

## itemAdminService.getById(id)

查询单个道具定义详情。

**Signature**:
```javascript
/**
 * @param {number} id - item_definition_id
 * @returns {Promise<ItemDefinitionView>}
 */
async function getById(id)
```

**Error Cases**:
- 抛出 `Error('道具不存在')` 当后端返回 404

---

## itemAdminService.create(data)

创建新道具定义。

**Signature**:
```javascript
/**
 * @param {Object} data - 表单数据（结构与 ItemDefinitionView 一致，无 item_definition_id）
 * @returns {Promise<ItemDefinitionView>}
 */
async function create(data)
```

**Behavior**:
- 调用 `POST /api/admin/items`
- 提交前将前端 camelCase 字段名转换为后端 snake_case
- 根据 `item_type` 自动清理无关字段（如创建 consumable 时，确保 `equipment_stats` 和 `equip_slot` 为 null）

**Error Cases**:
- 抛出 `Error('参数校验失败: {detail}')` 当后端返回 400
- 抛出 `Error('道具名称已存在')` 当后端返回 409

---

## itemAdminService.update(id, data)

修改道具定义。

**Signature**:
```javascript
/**
 * @param {number} id - item_definition_id
 * @param {Object} data - 全量表单数据
 * @returns {Promise<ItemDefinitionView>}
 */
async function update(id, data)
```

**Behavior**:
- 调用 `PUT /api/admin/items/:id`
- 采用全量替换策略提交所有字段
- 同 create，自动清理与当前类型无关的字段

**Error Cases**:
- 抛出 `Error('参数校验失败: {detail}')` 当后端返回 400
- 抛出 `Error('道具不存在')` 当后端返回 404

---

## itemAdminService.remove(id)

删除道具定义。

**Signature**:
```javascript
/**
 * @param {number} id - item_definition_id
 * @returns {Promise<void>}
 */
async function remove(id)
```

**Error Cases**:
- 抛出 `Error('该道具已被玩家持有，无法删除')` 当后端返回 400
- 抛出 `Error('道具不存在')` 当后端返回 404

---

## 错误处理统一约定

所有方法遵循以下错误处理模式：

1. **网络错误**（Axios 无响应）：抛出 `Error('网络异常，请检查网络连接')`
2. **HTTP 4xx/5xx 错误**：解析后端返回的错误消息，优先使用 `error.response.data.message`，若不存在则使用状态码默认文案
3. **业务错误**（如名称重复、已被持有）：透传后端返回的具体错误信息
