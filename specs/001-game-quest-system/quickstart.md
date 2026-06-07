# Quickstart: 游戏任务系统

**Feature**: 001-game-quest-system
**Date**: 2026/06/07

---

## 环境准备

本系统为服务端功能，复用现有 `server/` 目录的运行时环境，无需安装新依赖。

```powershell
cd server
npm install   # 如未安装过依赖
```

---

## 数据库初始化

任务系统新增 2 张表（`Quest`、`PlayerQuest`），通过 Sequelize 迁移文件管理。

```powershell
cd server
npm run migrate
```

迁移文件清单：
- `create-quest.js` — 任务定义表
- `create-player-quest.js` — 玩家任务实例表

---

## 启动服务

```powershell
cd server
npm run dev     # 开发模式（nodemon 热重载）
npm start       # 生产模式
```

服务启动后，任务相关 API 挂载在：
- 玩家接口：`http://localhost:3000/api/quests/*`
- 管理接口：`http://localhost:3000/api/admin/quests/*`

---

## 快速验证

### 1. 创建测试任务（管理端）

```bash
curl -X POST http://localhost:3000/api/admin/quests \
  -H "Content-Type: application/json" \
  -d '{
    "name": "快速测试任务",
    "description": "这是一个用于快速验证的任务",
    "quest_type": "side",
    "level_min": 1,
    "trigger_conditions": [{"trigger_type": "auto"}],
    "objectives": [{"objective_id": "obj_1", "type": "kill", "target_id": 5, "target_name": "史莱姆", "required_amount": 1, "description": "击杀1只史莱姆"}],
    "rewards": [{"reward_id": "reward_1", "type": "exp", "value": 10}],
    "is_active": true
  }'
```

### 2. 查询可接任务（玩家端）

```bash
curl "http://localhost:3000/api/quests/available?level=1"
```

### 3. 接取任务

```bash
curl -X POST http://localhost:3000/api/quests/1/accept
```

### 4. 查询我的任务

```bash
curl http://localhost:3000/api/quests/my
```

### 5. 模拟进度更新（内部触发）

进度更新通常由游戏中的其他事件触发（如击杀怪物）。在开发测试环境中，可通过内部调试接口或直接在数据库中修改 `PlayerQuest.progress_json` 来模拟。

### 6. 提交任务

```bash
curl -X POST http://localhost:3000/api/quests/201/submit
```

### 7. 领取奖励

```bash
curl -X POST http://localhost:3000/api/quests/201/claim
```

---

## 运行测试

```powershell
cd server
npm test                      # 运行全部测试（含覆盖率）
npm test -- quest             # 仅运行任务系统相关测试
npm run test:watch            # 监听模式
```

---

## 关键文件速查

| 文件 | 说明 |
|---|---|
| `server/src/models/Quest.js` | 任务定义模型 |
| `server/src/models/PlayerQuest.js` | 玩家任务实例模型 |
| `server/src/services/QuestService.js` | 查询与接取 |
| `server/src/services/QuestProgressService.js` | 进度跟踪与提交 |
| `server/src/services/QuestRewardService.js` | 奖励领取 |
| `server/src/services/QuestAdminService.js` | 管理 CRUD |
| `specs/001-game-quest-system/contracts/quest-api.md` | 玩家接口契约 |
| `specs/001-game-quest-system/contracts/quest-admin-api.md` | 管理接口契约 |
| `specs/001-game-quest-system/data-model.md` | 数据模型与 JSON Schema |

---

## 跨模块依赖提醒

任务系统在发放道具奖励时，直接调用 002 道具系统的 `InventoryService.addItems`。

- 调用前请确保 002 模块的 `ItemDefinition` 和 `InventoryService` 已正确初始化。
- 若修改 `InventoryService.addItems` 的签名，必须同步检查 `QuestRewardService` 中的调用方。
- 如需新增对 002 接口的消费，应在 `specs/002-game-item-system/contracts/internal-service.md` 中增补定义。
