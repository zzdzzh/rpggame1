# Quickstart: 道具配置管理前台

**Feature**: 003-item-config-frontend
**Date**: 2026/06/07

---

## 环境准备

### 1. 安装新增依赖

在 `client/` 目录下执行：

```powershell
cd client; npm install element-plus
```

Element Plus 提供管理后台所需的表格、表单、弹窗、分页等组件。

### 2. 配置 Vite 开发代理（可选）

若 002 后端服务在本地运行且端口与前台不同，在 `client/vite.config.js` 中添加代理配置：

```javascript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',  // 002 后端服务地址
        changeOrigin: true
      }
    }
  }
});
```

### 3. 启动开发服务器

```powershell
cd client; npm run dev
```

默认监听 `http://localhost:5173`（Vite 默认端口）。

---

## 访问管理页面

启动后：

1. 打开浏览器访问 `http://localhost:5173`
2. 在 App.vue 的页面切换入口（如顶部导航或快捷键）选择"道具配置"
3. 进入道具配置管理页面，列表自动加载第一页数据

---

## 人工 E2E 验收清单

按以下步骤进行人工测试，并留存截图：

### 列表查看
- [ ] 页面打开后，列表正确加载并展示道具名称、类型、品质、堆叠上限
- [ ] 翻页按钮正常工作，总页数与记录数匹配
- [ ] 加载过程中显示 loading 状态

### 创建道具
- [ ] 点击"新建道具"按钮，弹出表单弹窗
- [ ] 选择"消耗品"类型，显示消耗品效果字段；选择"装备"类型，显示装备属性和部位字段
- [ ] 留空必填项（如名称）后提交，显示校验错误提示
- [ ] 填写完整信息提交后，提示"创建成功"，列表自动刷新并出现新道具

### 编辑道具
- [ ] 点击列表中某行的"编辑"按钮，弹窗内预填充当前数据
- [ ] 修改字段后提交，提示"保存成功"，列表中对应行数据更新

### 删除道具
- [ ] 点击"删除"按钮，弹出确认对话框
- [ ] 点击"取消"，对话框关闭，数据无变化
- [ ] 点击"确认"，提示"删除成功"，列表中该行消失
- [ ] 尝试删除已被玩家持有的道具，提示"该道具已被玩家持有，无法删除"

### 筛选搜索
- [ ] 选择"类型=装备"筛选，列表仅展示装备
- [ ] 输入关键词"药水"搜索，列表仅展示名称包含"药水"的道具
- [ ] 清空筛选条件后，列表恢复展示全部数据

---

## 构建与部署

### 生产构建

```powershell
cd client; npm run build
```

构建产物输出到 `client/dist/` 目录，由部署流程统一处理静态资源托管。

### 部署注意事项

- 生产环境中 `/api` 路径由反向代理（如 Nginx）转发到后端服务，前台代码中使用相对路径即可
- 确保 002-game-item-system 的后端服务已部署且 Item Admin API 可用
