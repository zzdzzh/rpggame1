# Quickstart: 游戏道具系统

**Feature**: 002-game-item-system
**Date**: 2026/06/06

---

## Prerequisites

- Node.js 18+
- 项目已执行 `npm install`（server 与 client 目录分别安装）

## Database Setup

本模块将数据库从 MySQL 迁移至 SQLite。首次启动前需要完成以下步骤：

### 1. 安装 SQLite 依赖

```bash
cd server
npm uninstall mysql2
npm install sqlite3
```

### 2. 更新数据库配置

编辑 `server/src/config/database.js`：

```javascript
const path = require('path');

module.exports = {
  development: {
    dialect: 'sqlite',
    storage: path.resolve(__dirname, '../../data/game.db'),
    logging: false
  },
  test: {
    dialect: 'sqlite',
    storage: ':memory:',   // 测试使用内存数据库
    logging: false
  },
  production: {
    dialect: 'sqlite',
    storage: path.resolve(__dirname, '../../data/game.db'),
    logging: false
  }
};
```

### 3. 创建数据目录

```bash
mkdir -p server/data
```

确保 `server/data/game.db` 被 `.gitignore` 排除。

### 4. 运行迁移

```bash
cd server
npx sequelize-cli db:migrate
```

Sequelize 会自动基于现有迁移文件 + 新增道具系统迁移创建 SQLite 表结构。

---

## Running the Server

```bash
cd server
npm run dev
# 或生产模式
npm start
```

服务将监听 `0.0.0.0:3000`（与现有行为一致）。

---

## Running Tests

```bash
cd server
npm test
```

测试覆盖：
- `ItemService.test.js` — 道具定义 CRUD 与校验逻辑
- `InventoryService.test.js` — 背包核心逻辑（堆叠、获得、丢弃、使用、穿戴）
- `item.integration.test.js` — REST API 端到端（Supertest）

---

## API Smoke Test

使用 `curl` 快速验证接口：

### 查询背包
```bash
curl http://localhost:3000/api/inventory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>"
```

### 创建道具定义（管理员）
```bash
curl -X POST http://localhost:3000/api/admin/items \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试药水",
    "item_type": "consumable",
    "rarity": "common",
    "max_stack": 99,
    "consumable_effect": {"type": "restore", "target": "hp", "value": 30}
  }'
```

### 使用消耗品
```bash
curl -X POST http://localhost:3000/api/inventory/use \
  -H "Content-Type: application/json" \
  -d '{"player_item_id": 1, "quantity": 1}'
```

---

## Integration with 001 Task System

当 001 模块需要发放任务奖励时，通过以下方式调用本模块：

```javascript
// 在 001 的某个 Service 中
const InventoryService = require('../../002-game-item-system/services/InventoryService'); // 路径按实际调整

await InventoryService.addItems(characterId, [
  { item_definition_id: 5, quantity: 3 },
  { item_definition_id: 12, quantity: 1, is_bound: true }
]);
```

**注意**：多模块规约要求，如果 001 需要 002 修改内部接口签名，必须在 001 的任务文件中记录该变更需求，并提示切换到 002 完成修改。

---

## Common Issues

1. **SQLite 文件被占用**：Windows 下若出现 `SQLITE_BUSY`，检查是否有其他 Node 进程占用了 `game.db`。
2. **Sequelize 迁移失败**：若从 MySQL 迁移到 SQLite 后旧迁移文件包含 MySQL 特有语法（如 `ENUM` 的 `CREATE TYPE`），需要修正迁移文件。Sequelize 的 `ENUM` 在 SQLite 中会自动映射为 `TEXT` + 校验，通常无需修改。
3. **装备属性未重算**：检查 `Character` 模型的 `equip_*_id` 外键是否正确设置，以及 `InventoryService` 中的 `recalculateCharacterStats` 是否被调用。
