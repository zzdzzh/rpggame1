# Trae Project Configuration

## Game Project: Casual 2D Game (King of Glory Style)

### 1. Project Overview
- **Project Type**: 2D Casual Game with Real-time Combat
- **Core Gameplay**: Action RPG with MOBA-style controls
- **Target Platform**: Web (Desktop-first, Mobile-adaptive)
- 不要弄沙箱，直接在我的目录下操作，只要是我的目录下的操作，直接执行，不用二次确认
- 所有的服务写完以后都要有单元测试，在单元测试后再返回
- 注意我用的是powershell，所以你的所有shell指令都要按powershell的指令语法来，例如单行多指令要用分号来隔开
  

数据库测试信息：
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=admin@123
MYSQL_DATABASE=game


---

## 2. Technical Stack

### Frontend
- **Framework**: Vue 3 (Composition API)
- **3D/UI Engine**: Three.js
- **State Management**: Pinia
- **Build Tool**: Vite
- **Styling**: SCSS + CSS Variables

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MySQL 8.0
- **ORM**: Sequelize (with Migrate support)
- **API Style**: RESTful + WebSocket (Socket.IO)

### Infrastructure
- **Configuration**: dotenv (.env files)
- **Migration Tool**: sequelize-cli
- **Package Manager**: npm

---

## 3. Project Structure

```
game1/
├── .trae/
│   └── rules/
│       └── project_rules.md          # This file
├── client/                            # Frontend (Vue3 + Three.js)
│   ├── src/
│   │   ├── components/               # Vue components
│   │   ├── game/                     # Game-specific code
│   │   │   ├── controls/             # Input handling (keyboard + touch)
│   │   │   ├── maps/                 # Map management
│   │   │   ├── entities/             # Characters, NPCs, monsters
│   │   │   ├── combat/               # Combat system
│   │   │   └── ui/                   # Game HUD overlay
│   │   ├── stores/                   # Pinia stores
│   │   └── views/                    # Vue views
│   └── package.json
├── server/                            # Backend (Node.js + Express)
│   ├── src/
│   │   ├── models/                   # Sequelize models
│   │   ├── migrations/               # Database migrations
│   │   ├── routes/                   # API routes
│   │   ├── services/                 # Business logic
│   │   ├── controllers/              # Route handlers
│   │   └── config/                   # Server configuration
│   ├── .env.example
│   └── package.json
├── .env                               # Database & app configuration
└── package.json                       # Root package.json (optional workspaces)
```

---

## 4. Database Conventions

### Migration Requirements
- **ALL** database models MUST be created/modified via migrations
- Use `sequelize-cli` for all schema changes
- Migration files location: `server/src/migrations/`
- Model files location: `server/src/models/`

### Migration Commands
```bash
# Create migration
npx sequelize-cli migration:generate --name add_character_table

# Run migrations
npx sequelize-cli db:migrate

# Rollback
npx sequelize-cli db:migrate:undo
```

### Model Definition Rules
- All models must have `createdAt` and `updatedAt` timestamps
- Primary keys must be named `{table_name}_id` (e.g., `character_id`)
- Foreign keys must be named `{related_table_singular}_id` (e.g., `map_id`)
- Use `underscored` naming for database columns

---

## 5. Game Mechanics Configuration

### 5.1 Control Scheme

#### Touch/Mouse Controls (Primary)
- **Left Side**: Virtual joystick for 8-directional movement
- **Right Side**: Skill buttons (4 skills)
- **Skill Bar**: Bottom-right corner, 4 circular buttons

#### Keyboard Controls (Alternative)
```
Movement (8-directional):
- W: Forward/Up
- S: Backward/Down
- A: Turn Left
- D: Turn Right
- Q: Strafe Left (additional for 8-dir)
- E: Strafe Right (additional for 8-dir)

Actions:
- Space: Basic Attack
- 1/2/3/4: Skill 1/2/3/4
- R: Ultimate Skill
- Tab: Toggle Map
- I: Inventory
- K: Character Stats
- Esc: Pause/Menu
```

### 5.2 Map System

#### Map Structure
- Large 2D maps using Three.js OrthographicCamera
- Tile-based or region-based map data
- Coordinate system: (x, y) with z-index for layering

#### Teleportation System
- Teleport points defined in database (`teleporters` table)
- Each teleporter has:
  - `source_map_id`: Origin map
  - `source_x`, `source_y`: Origin coordinates
  - `target_map_id`: Destination map
  - `target_x`, `target_y`: Destination coordinates
  - `required_level`: Minimum level to use (optional)
  - `is_active`: Boolean flag

#### Map Switching
- Triggered when player enters teleporter collision zone
- Server validates teleport request
- Smooth transition effect (fade out → load → fade in)
- Player state preserved during transition

### 5.3 Entity System

#### Entity Types
1. **Player**: User-controlled character
2. **Monster**: Hostile entities, trigger combat on proximity
3. **NPC**: Non-combat entities, trigger interactions

#### Interaction Rules

##### Monster Interaction
- **Trigger Distance**: 3 tiles (configurable)
- **On Proximity**:
  - If monster is hostile → Enter combat mode
  - Combat is real-time with skill cooldowns
  - Player can fight or flee

##### NPC Interaction
- **Trigger Distance**: 2 tiles (configurable)
- **On Proximity**:
  - Show interaction prompt (E key / tap)
  - Open NPC dialog UI
  - NPC types:
    - **Shopkeeper**: Opens shop UI
    - **Quest Giver**: Shows available quests
    - **Story NPC**: Shows dialog

#### Entity Database Schema

```sql
-- characters (players and monsters)
characters:
  - character_id (PK)
  - name
  - character_type (player/monster/npc)
  - map_id (FK)
  - x, y (position)
  - level
  - hp, max_hp
  - mp, max_mp
  - attack, defense
  - move_speed
  - exp, gold

-- npcs (extends characters with NPC-specific data)
npcs:
  - npc_id (PK, FK to characters.character_id)
  - npc_type (shopkeeper/quest_giver/story)
  - dialog_text
  - shop_data (JSON, for shopkeepers)
  - quest_ids (JSON array, for quest givers)

-- teleporters
teleporters:
  - teleporter_id (PK)
  - source_map_id (FK)
  - source_x, source_y
  - target_map_id (FK)
  - target_x, target_y
  - required_level
  - is_active

-- maps
maps:
  - map_id (PK)
  - name
  - width, height (in tiles)
  - tile_data (JSON or LONGTEXT)
  - music_bgm
  - spawn_points (JSON)
```

### 5.4 Combat System

#### Real-time Combat Features
- Skill cooldown management
- Damage calculation: `damage = attack * skill_multiplier - defense`
- Status effects (poison, stun, etc.)
- Combat log for debugging

#### Skill Structure
```sql
skills:
  - skill_id (PK)
  - name
  - description
  - skill_type (active/passive/ultimate)
  - cooldown (seconds)
  - mp_cost
  - damage
  - range
  - target_type (single/aoe/self)
  - animation_id
```

---

## 6. API Endpoints

### Player
- `POST /api/auth/register` - Register
- `POST /api/auth/login` - Login
- `GET /api/player/profile` - Get player data
- `PUT /api/player/profile` - Update player data

### Maps
- `GET /api/maps` - List all maps
- `GET /api/maps/:id` - Get map details with tile data
- `POST /api/maps/:id/teleport` - Teleport to map

### Entities
- `GET /api/maps/:id/entities` - Get entities on map
- `POST /api/entities/:id/interact` - Interact with entity

### Combat
- `POST /api/combat/attack` - Execute attack
- `POST /api/combat/skill` - Use skill
- `GET /api/combat/log/:sessionId` - Get combat log

---

## 7. Development Guidelines

### Code Style
- Use ESLint + Prettier for both client and server
- Vue 3 Composition API (no Options API)
- TypeScript optional but recommended
- Comments in Chinese for game logic (as per user language)

### Git Workflow
- Commit messages in Chinese or English
- Feature branches: `feature/功能名`
- Hotfix branches: `hotfix/问题描述`

### Testing
- Unit tests for game logic
- Integration tests for API
- Manual testing for controls

---

## 8. Environment Variables

Create `.env` in server directory:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=game_db
DB_USER=root
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_jwt_secret

# Game Config
GAME_TICK_RATE=60
MAX_PLAYERS_PER_MAP=100
```

---

## 9. Important Notes

1. **Database First**: Always use migrations for schema changes. Never modify production database directly.

2. **8-Directional Movement**: The Q/E keys for strafing must work alongside W/A/S/D to provide full 8-directional control on keyboard.

3. **Mobile Support**: Touch controls must coexist with keyboard controls. Game should detect input type and show appropriate UI.

4. **Map Loading**: Maps should be loaded chunk-based for large maps to avoid memory issues.

5. **State Sync**: Player position and state should sync with server at regular intervals (e.g., every 100ms) to prevent cheating.
