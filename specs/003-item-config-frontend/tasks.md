# Tasks: 道具配置管理前台

**Input**: Design documents from `/specs/003-item-config-frontend/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 本 feature 不生成自动化测试任务，遵循 Constitution 采用人工 E2E 验收。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 安装依赖并创建前台项目结构

- [ ] T001 Install Element Plus in `client/` (`cd client; npm install element-plus`)
- [ ] T002 Create directory structure: `client/src/views/`, `client/src/components/item-config/`, `client/src/services/`, `client/src/constants/`
- [ ] T003 Register Element Plus and Chinese locale in `client/src/main.js`
- [ ] T004 [P] Configure Vite dev proxy for `/api` in `client/vite.config.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 核心基础代码，所有 User Story 依赖这些文件

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 [P] Create enum constants file `client/src/constants/itemEnums.js` (ITEM_TYPE_MAP, RARITY_MAP, EQUIP_SLOT_MAP, EFFECT_TYPE_MAP, TARGET_MAP)
- [ ] T006 Create API service `client/src/services/itemAdminService.js` with list/getById/create/update/remove methods (wraps 002 Item Admin API)
- [ ] T007 Create Pinia store `client/src/stores/itemConfigStore.js` with list state, form state, loading flags, and actions
- [ ] T008 Create view shell `client/src/views/ItemConfigView.vue` with basic layout container for list and form

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 查看道具定义列表 (Priority: P1) 🎯 MVP

**Goal**: 管理员打开页面即可看到分页的道具定义列表，包含名称、类型、品质、堆叠上限等关键信息

**Independent Test**: 启动 dev server，打开道具配置页面，验证列表加载20条数据并展示中文标签，分页按钮可翻页，加载时显示 loading

- [ ] T009 [US1] Implement `client/src/components/item-config/ItemList.vue` with `el-table`, `el-pagination`, loading state and empty state
- [ ] T010 [P] [US1] Add Chinese enum label rendering and column formatting in `client/src/components/item-config/ItemList.vue`
- [ ] T011 [US1] Connect `ItemList.vue` to `itemConfigStore` for data fetching and pagination
- [ ] T012 [US1] Integrate `ItemList.vue` into `ItemConfigView.vue` and verify end-to-end data flow

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - 创建新道具定义 (Priority: P1)

**Goal**: 管理员点击新建按钮，填写表单并提交，系统创建新道具定义

**Independent Test**: 在列表页面点击"新建"，填写完整信息后提交，验证列表自动刷新并出现新道具；留空必填项时表单阻止提交并提示错误

- [ ] T013 [P] [US2] Implement basic form fields in `client/src/components/item-config/ItemForm.vue` (name, description, type, rarity, icon, max_stack, level_requirement, is_bind_on_pickup)
- [ ] T014 [P] [US2] Implement dynamic field switching in `ItemForm.vue` (show consumable_effect when type=consumable; show equipment_stats + equip_slot when type=equipment)
- [ ] T015 [US2] Add form validation rules in `ItemForm.vue` using `el-form` rules
- [ ] T016 [US2] Integrate `ItemForm.vue` create mode with store and service; add "新建道具" button in `ItemList.vue` toolbar

**Checkpoint**: User Story 2 works independently — can create items and see them in the list

---

## Phase 5: User Story 3 - 编辑道具定义 (Priority: P1)

**Goal**: 管理员点击编辑按钮，修改表单并提交，系统更新道具定义

**Independent Test**: 点击列表中某行的"编辑"，修改名称后提交，验证列表中该行数据更新，且表单预填充了原数据

- [ ] T017 [US3] Add edit button to each row in `client/src/components/item-config/ItemList.vue`
- [ ] T018 [US3] Implement form prefill logic in `client/src/components/item-config/ItemForm.vue` for edit mode (populate fields from selected item)
- [ ] T019 [US3] Integrate `ItemForm.vue` edit mode with store and service (call PUT /api/admin/items/:id)

**Checkpoint**: User Story 3 works independently — can edit existing items

---

## Phase 6: User Story 4 - 删除道具定义 (Priority: P2)

**Goal**: 管理员删除未被玩家持有的道具定义，已被持有的道具给出错误提示

**Independent Test**: 点击删除按钮并确认，验证列表中该行消失；尝试删除已被持有的道具，验证错误提示出现

- [ ] T020 [P] [US4] Implement `client/src/components/item-config/ItemDeleteDialog.vue` with `el-dialog` and confirmation text
- [ ] T021 [US4] Add delete button to each row in `client/src/components/item-config/ItemList.vue` and wire up confirmation flow
- [ ] T022 [US4] Integrate delete flow with store and service; handle 400 error for items held by players

**Checkpoint**: User Story 4 works independently — can delete unused items, blocked for held items

---

## Phase 7: User Story 5 - 筛选与搜索道具定义 (Priority: P2)

**Goal**: 管理员通过类型筛选、品质筛选和关键词搜索快速定位道具

**Independent Test**: 选择"类型=装备"筛选，验证列表仅展示装备；输入"药水"搜索，验证仅展示匹配项；清空条件后恢复全部

- [ ] T023 [P] [US5] Add filter controls (`el-select` for type and rarity) to `client/src/components/item-config/ItemList.vue` toolbar
- [ ] T024 [P] [US5] Add keyword search input (`el-input`) to `client/src/components/item-config/ItemList.vue` toolbar
- [ ] T025 [US5] Connect filters and search to `itemConfigStore` and `itemAdminService` with debounced reload

**Checkpoint**: User Story 5 works independently — filtering and searching work correctly

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 页面集成、全局优化和人工验收

- [ ] T026 Add page toggle to `client/src/App.vue` to switch between `GameView` and `ItemConfigView`
- [ ] T027 Run dev server and perform manual E2E testing per `quickstart.md`
- [ ] T028 Fix any visual issues, console warnings, or interaction bugs found during manual testing
- [ ] T029 [P] Verify all success/error feedback messages (`ElMessage`) are user-friendly and in Chinese
- [ ] T030 [P] Add responsive layout basics to `ItemConfigView.vue` and `ItemList.vue` (min-width, scrollable table)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 (Phase 3) must complete before US2-US5 can integrate into the list/form
  - US2 (Phase 4) must complete before US3 (edit reuses ItemForm.vue create mode)
  - US4 (Phase 6) and US5 (Phase 7) can be done in parallel with US2/US3 once US1 is done
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **User Story 2 (P1)**: Can start after US1 — needs ItemList.vue toolbar and ItemConfigView.vue shell
- **User Story 3 (P1)**: Can start after US2 — reuses ItemForm.vue from US2
- **User Story 4 (P2)**: Can start after US1 — only needs list rows and confirmation dialog
- **User Story 5 (P2)**: Can start after US1 — only needs list toolbar and data reload

### Within Each User Story

- Components before integration with store/service
- Core UI before edge cases (loading/empty/error states)
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T004 is independent of T001-T003)
- All Foundational tasks marked [P] can run in parallel (T005 is independent of T006-T008)
- T009 and T010 (US1) can run in parallel (different concerns within same file)
- T013, T014 (US2) can run in parallel (different form sections)
- T020 (US4) can run in parallel with T013-T016 (US2) once Foundational is done
- T023, T024 (US5) can run in parallel (different toolbar controls)
- T029 and T030 (Polish) can run in parallel

---

## Parallel Example: User Story 1 + US2 + US4

```bash
# After Foundational phase completes:
Task: "Implement ItemList.vue table with el-table and pagination"
Task: "Add Chinese enum labels in ItemList.vue"
Task: "Implement ItemForm.vue basic form fields"
Task: "Implement dynamic field switching in ItemForm.vue"
Task: "Implement ItemDeleteDialog.vue"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (列表查看)
4. **STOP and VALIDATE**: Open browser, verify list loads with pagination and Chinese labels
5. Continue with remaining stories

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (列表) → Test independently → 可演示基础列表
3. Add US2 (创建) + US3 (编辑) → Test independently → 可演示完整增改流程
4. Add US4 (删除) → Test independently → 可演示完整增删改
5. Add US5 (筛选搜索) → Test independently → 管理体验完整
6. Polish → 人工 E2E 验收通过

### Suggested Execution Order (单人开发)

1. T001 → T002 → T003 → T004 (Setup)
2. T005 → T006 → T007 → T008 (Foundational)
3. T009 → T010 → T011 → T012 (US1 - MVP)
4. T013 → T014 → T015 → T016 (US2 - 创建)
5. T017 → T018 → T019 (US3 - 编辑)
6. T020 → T021 → T022 (US4 - 删除)
7. T023 → T024 → T025 (US5 - 筛选搜索)
8. T026 → T027 → T028 → T029 → T030 (Polish)

---

## Notes

- [P] tasks = different files or independent concerns, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- 所有与 002 模块实体/契约的交互必须通过 `itemAdminService.js`，禁止在组件中直接调用 Axios
