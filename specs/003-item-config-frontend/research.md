# Research: 道具配置管理前台

**Feature**: 003-item-config-frontend
**Date**: 2026/06/07

---

## 决策记录

### 1. UI 组件库选择

**Decision**: 使用 Element Plus 作为管理后台 UI 组件库

**Rationale**:
- Constitution 已明确规定前台技术栈为 Vue 3 + Element Plus + three.js
- 管理后台所需表格（el-table）、表单（el-form）、弹窗（el-dialog）、分页（el-pagination）均为 Element Plus 核心组件，开箱即用
- Element Plus 提供完整的中文语言包和中文文档，降低开发门槛
- 与 Vue 3 Composition API 和 Pinia 生态兼容良好

**Alternatives considered**:
- Ant Design Vue：功能类似，但 Constitution 已指定 Element Plus
- 纯手写组件：无需新增依赖，但表格排序/筛选、表单校验、分页逻辑代码量过大，与"不用太复杂"冲突
- Naive UI：轻量但社区生态和中文文档不如 Element Plus 成熟

### 2. 页面路由方案

**Decision**: 不引入 Vue Router，在 App.vue 中使用条件渲染（v-if）在游戏画面和管理页面之间切换

**Rationale**:
- 当前客户端仅有单一游戏视图，无路由需求
- 为单一管理页面引入 Vue Router 属于过度设计，违反 Constitution 简单优先原则
- 条件渲染通过简单状态变量（如 `currentView`）即可实现，复杂度最低
- 若未来前台页面增多，再考虑引入 Vue Router 进行重构

**Alternatives considered**:
- Vue Router：标准做法，但当前仅需两个视图切换，引入成本大于收益
- 独立 HTML 页面：需要单独构建配置或脱离 Vite 构建流程，与"集成到现有 client"冲突

### 3. 状态管理方案

**Decision**: 使用 Pinia Store（`itemConfigStore.js`）管理列表状态、筛选条件和表单状态

**Rationale**:
- Pinia 已在项目中安装并配置（`main.js` 中已 `createPinia()`）
- 列表分页、筛选条件、加载状态在多个子组件间共享，使用 Store 避免 prop drilling
- 表单状态（创建/编辑）需要跨 `ItemList` 和 `ItemForm` 组件通信，Store 是最简洁方案

**Alternatives considered**:
- Provide/Inject：Vue 3 内置，但 Pinia 已存在且提供更完善的 Devtools 支持
- 组件事件冒泡：列表和表单嵌套层级可能导致事件链过长

### 4. API 调用封装

**Decision**: 使用 Axios 直接调用 002 后端 API，封装为 `itemAdminService.js` 模块

**Rationale**:
- Axios 已在客户端依赖中
- 002 的 Item Admin API 契约已完整定义（`specs/002-game-item-system/contracts/item-admin-api.md`）
- 前台无复杂请求拦截/错误重试需求，无需引入额外 HTTP 客户端封装层

**API Base URL 处理**:
- 开发阶段通过 Vite 的 `server.proxy` 将 `/api` 代理到本地后端服务
- 生产阶段由部署环境统一配置反向代理，前台代码中使用相对路径 `/api/admin/items`

### 5. 表单校验方案

**Decision**: 使用 Element Plus 的表单校验（`el-form` + `rules`）结合提交前的手动校验

**Rationale**:
- Element Plus 表单组件内置 async-validator，支持必填、类型、范围等常见校验规则
- 动态字段切换（消耗品效果 vs 装备属性）时，通过动态修改 rules 实现条件校验
- 后端 002 也会做二次校验，前端校验主要为了提升用户体验（即时反馈）

### 6. 枚举中文映射

**Decision**: 在前端维护独立的枚举映射常量（`ITEM_TYPE_MAP`、`RARITY_MAP`、`EQUIP_SLOT_MAP`），与 002 定义的枚举值保持一致

**Rationale**:
- 002 API 返回英文编码值（如 `consumable`、`rare`），前台需展示中文标签
- 映射表为纯常量对象，无运行时依赖，修改成本低
- 若 002 扩展新枚举值，前台需同步更新映射表（模块边界纪律要求显式申报消费关系）

**映射定义**:
```javascript
const ITEM_TYPE_MAP = {
  consumable: '消耗品',
  equipment: '装备',
  material: '材料',
  quest: '任务道具'
};

const RARITY_MAP = {
  common: '普通',
  uncommon: '优秀',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说'
};

const EQUIP_SLOT_MAP = {
  weapon: '武器',
  helmet: '头盔',
  armor: '护甲',
  accessory: '饰品'
};
```

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Element Plus 体积增大打包体积 | 中 | 使用 Vite 的按需自动导入（`unplugin-vue-components` + `unplugin-auto-import`），仅打包实际使用的组件 |
| 002 后端 API 尚未完全实现 | 高 | 前台开发时可使用 Mock 数据；plan 阶段明确 002 的 item-admin-api.md 为契约依据，若 002 实现有变，走多模块规约流程在 002 侧修改 |
| 两名管理员同时编辑同一道具 | 低 | 002 后端 PUT 接口为全量替换，后提交者覆盖前者；前台通过"编辑前重新拉取最新数据"降低冲突概率，V1 不实现乐观锁 |
