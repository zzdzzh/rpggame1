# Research: 游戏道具系统技术决策

**Feature**: 002-game-item-system
**Date**: 2026/06/06

---

## Decision 1: 数据库从 MySQL 迁移至 SQLite

**Decision**: 使用 `sqlite3` npm 包（v5.1.x）配合 Sequelize 的 `dialect: 'sqlite'`。数据库文件存放于 `server/data/game.db`。

**Rationale**:
- Constitution 明确要求 "数据库采用sqlite，但不要用编译版本，直接用js的版本即可"。
- Sequelize 原生支持 SQLite dialect，迁移成本最低：仅需修改 `database.js` 配置，所有模型定义（DataTypes、关系、迁移）完全兼容。
- `sqlite3` 包 v5+ 提供预编译二进制文件（包括 Windows x64），在安装时通常不需要本地编译工具链（Python/VS Build Tools），符合 "直接用js的版本" 的精神。
- 备选 `better-sqlite3` 需要编译且对并发写入的支持对本项目（单进程 Node.js + 1000 并发读取为主）并无必要。
- 备选 `sql.js`（纯 WASM）虽然零编译，但默认内存数据库，持久化需要手动导出/导入文件，增加不必要复杂度。

**Alternatives considered**:
- `better-sqlite3`: 同步 API 更快，但需要编译；否决。
- `sql.js`: 纯 JS/WASM；否决，持久化方案不自然。
- 保留 MySQL: 直接违反 Constitution；否决。

**Impact**:
- `server/package.json` 移除 `mysql2`，添加 `sqlite3`。
- `server/src/config/database.js` 改为 SQLite 单文件配置。
- 原有 Sequelize 迁移文件无需重写，Sequelize CLI 的 `db:migrate` 对 SQLite 同样生效。

---

## Decision 2: 装备穿戴采用 Character 固定字段方案

**Decision**: 在 `Character` 模型上增加 4 个外键字段（`equip_weapon_id`, `equip_helmet_id`, `equip_armor_id`, `equip_accessory_id`）指向 `PlayerItem`，而非创建独立的 `PlayerEquipment` 关联表。

**Rationale**:
- 本项目 V1 仅支持 4 个固定装备部位，未来扩展概率低（Constitution 简单优先 / YAGNI）。
- 固定字段避免了额外 JOIN 查询，穿戴/卸下时只需更新 Character 单表 + PlayerItem 单表，性能最优。
- 属性重算时直接读取 Character 上 4 个字段对应的 ItemDefinition 属性即可，逻辑直观。

**Alternatives considered**:
- 动态 `PlayerEquipment` 表（character_id, slot_type, player_item_id）：更灵活，支持未来扩展部位；否决，当前无需过度设计。
- JSON 字段存储装备映射：`equipment_json: {weapon: id, helmet: id...}`；否决，Sequelize 对 SQLite JSON 支持尚可但查询和索引不如独立字段直观。

**Impact**:
- 需要修改 `server/src/models/Character.js`（添加 4 个字段）。
- `InventoryService.equip()` 和 `unequip()` 逻辑简单直接。

---

## Decision 3: 跨模块奖励发放采用 Service 层直接调用

**Decision**: 001 任务系统在发放奖励时，直接 `require` 002 模块的 `InventoryService.addItems(characterId, rewards)` 方法。不通过 HTTP 内部调用，也不引入消息队列。

**Rationale**:
- 两个模块位于同一 Node.js 进程内，Service 层直接调用是最简单、性能最高的方式。
- Constitution 简单优先原则明确反对引入当前阶段不需要的运行时组件（如消息队列、内部 HTTP 网关）。
- 直接调用意味着 001 对 002 存在编译时/加载时依赖，符合模块边界纪律中的 "显式申报" 要求——已在 data-model.md 中标注 `InventoryService.addItems` 的 Consumed By 为 001 任务系统。

**Alternatives considered**:
- 内部 REST API 调用（001 后端调 002 后端接口）：同一进程内无意义，增加网络开销；否决。
- EventEmitter / 消息队列：解耦更好，但本项目规模下过度设计；否决。

**Impact**:
- 002 的 `InventoryService.js` 必须导出稳定的方法签名供 001 消费。
- 任何对 `addItems` 签名的变更，必须同步检查 001 模块的调用方（模块边界纪律）。

---

## Decision 4: 消耗品效果在服务端计算并推送

**Decision**: 玩家使用消耗品时，服务端计算效果（如 hp = min(max_hp, hp + 30)），更新 Character 表，然后通过 Socket.io `io.to(characterId).emit('characterUpdate', updatedCharacter)` 推送变更。客户端收到后更新本地 Pinia store。

**Rationale**:
- 当前项目已使用 Socket.io 进行位置广播（`positionsUpdate`），复用现有通道成本最低。
- 若仅依赖 REST 响应，客户端需要手动处理响应并更新状态；Socket.io 推送可确保多端同步（如玩家在手机和 PC 同时在线时的状态一致性，虽然本项目暂不支持多客户端，但为未来预留）。
- 对于背包本身的变更（获得/丢弃道具），以 REST 响应返回最新背包数据即可，无需额外 Socket.io 推送（前端可在收到响应后主动刷新）。

**Alternatives considered**:
- 纯 REST，客户端轮询：增加不必要的请求；否决。
- 新增独立的 WebSocket event 类型：可以，但复用 `characterUpdate` 事件足够（装备变更也会触发角色属性变化）。

**Impact**:
- `server/src/index.js` 中已有的 `io` 实例可在 `InventoryService` 中引用（通过依赖注入或 module.exports 解耦）。
- 客户端 `GameView.vue` 或 store 中需监听 `characterUpdate` 事件。

---

## Decision 5: 道具定义的效果/属性以 JSON 字段存储

**Decision**: `ItemDefinition` 模型中使用 `DataTypes.JSON` 存储 `consumable_effect` 和 `equipment_stats`，而非拆分为独立的 `ConsumableEffect` / `EquipmentStats` 关联表。

**Rationale**:
- 本项目 V1 的消耗品效果结构简单（`{type: 'restore', target: 'hp', value: 30}`），装备属性也简单（`{attack: 15, defense: 5}`）。JSON 字段足以表达，避免了 2-3 个额外的关联表。
- Sequelize + SQLite 对 JSON 字段支持良好（SQLite 3.38+ 原生支持 JSON，Sequelize 会自动处理）。
- 管理端增删改查时，前端直接提交 JSON 对象，无需复杂的多表事务。

**Alternatives considered**:
- 独立表 `ConsumableEffects` 和 `EquipmentStats`：范式更规范，支持效果/属性的复杂查询；否决，当前场景下查询通常按 ItemDefinition 维度进行，极少单独查"所有加攻击力的装备属性"。

**Impact**:
- `ItemDefinition` 模型包含两个 JSON 字段。
- 服务端在解析效果/属性时需做基础校验（如 `effect.type` 必须在允许列表内）。
