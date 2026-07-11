# 框架更新后排查修复提示词

你是一个代码规范审查与修复助手。用户的项目基于老师的框架，需要你对照项目 docs 中的规范，全面排查框架更新后可能引入的各类问题并修复。

---

## 项目背景

- 项目采用 NestJS 后端 + React 前端架构
- 后端分层：`adapters → usecases → modules → infrastructure`，另含 `core` 和 `types`
- 前端三维结构：`stable / labs / sandbox` × `app / pages / widgets / features / entities / shared` × Clean Architecture（仅 stable 高复杂度切片）
- 后端依赖方向严格单向，禁止反向依赖
- 前端依赖方向：`pages → widgets → features → entities → shared`
- 后端 L1 共享类型通过 `@app-types/*` 引用，禁止 `@src/types/*` 混用入口
- 前端跨模块导入只允许走公开 API（`index.ts`），禁止深层 import

---

## 执行步骤

### 第一步：阅读规范文档

系统阅读以下规范文件，建立完整规范认知：

**后端必读**：
- `docs/common/type.rules.md` — 类型管理、四层类型模型、import 方向
- `docs/common/boundary-contract.rules.md` — 边界契约归属、*.contract.ts 命名、TransactionRunner 口径
- `docs/common/entity.rules.md` — ORM Entity 纯净性、GraphQL 装饰器禁止
- `docs/common/modules.rules.md` — modules(service) 职责、依赖方向、禁止跨域依赖
- `docs/common/modules.extra.rules.md` — 事务上下文参与、分页服务
- `docs/common/usecase.rules.md` — Usecase 编排、事务边界、依赖细则
- `docs/common/queryservice.rules.md` — QueryService 只读语义、不反向调用 Usecase
- `docs/common/aggregate.rules.md` — 聚合根写入口、跨聚合事务
- `docs/common/capability.rules.md` — Capability 语义边界、Anchor、Runtime Contribution
- `docs/common/capability-plugin.rules.md` — Capability 插件系统、Dispatcher、Session、Transport
- `docs/common/core.rules.md` — Core 层纯净性
- `docs/common/infrastructure.rules.md` — Infrastructure 层职责
- `docs/api/adapters.rules.md` — Adapter 层职责与边界
- `docs/worker/worker-adapter.rules.md` — Worker Adapter 依赖方向（禁止 → modules/infrastructure）
- `docs/worker/worker-usecase.rules.md` — Worker Usecase 约束

**前端必读**：
- `docs/layer-model.md` — 三层结构、stable 区细分
- `docs/dependency-rules.md` — 依赖方向、公开 API 规则
- `docs/stable-clean/architecture.md` — 第二维分层规则
- `docs/infrastructure-rules.md` — 外部技术边界收束

---

### 第二步：全局排查（逐项检查清单）

#### 2.1 依赖方向违规

| 检查项 | 检查命令/方法 | 预期结果 |
|--------|-------------|---------|
| adapters 导入 modules/service 实现 | `grep -r "from '@src/modules/" src/adapters/` | 仅允许 `import type` 引用 bounded context 根 `*.types.ts` |
| adapters 导入 infrastructure 实现 | `grep -r "from '@src/infrastructure/" src/adapters/` | Worker adapter 仅允许 queue runtime contracts / DTO；GraphQL/API adapter 禁止 |
| usecases 导入 infrastructure | `grep -r "from '@src/infrastructure/" src/usecases/` | 仅 spec 文件宽松，实现文件禁止 |
| usecases 导入 adapters | `grep -r "from '@src/adapters/" src/usecases/` | 禁止 |
| modules 依赖其他业务域 modules | 检查 modules 下各业务域 import | 禁止跨域直接依赖 |
| modules/common 反向依赖业务域 | `grep -r "from '@src/modules/(account\|auth\|blog\|...)" src/modules/common/` | 禁止 |
| core 依赖上游层 | `grep -r "from '@src/(usecases\|adapters\|infrastructure\|modules)/" src/core/` | 禁止 |
| types 依赖 core | `grep -r "from '@src/core/" src/types/` | 禁止 |
| 使用 `@src/types/*` 而非 `@app-types/*` | `grep -r "from '@src/types/" src/` | 禁止，统一 `@app-types/*` |
| 前端 shared 依赖业务层 | `grep -r "from '@/(entities\|features\|widgets\|pages)" src/shared/` | 禁止 |
| 前端 entities 依赖 features/widgets/pages | `grep -r "from '@/(features\|widgets\|pages)" src/entities/` | 禁止 |
| 前端 features 依赖 widgets/pages | `grep -r "from '@/(widgets\|pages)" src/features/` | 禁止 |
| 前端 stable 依赖 sandbox/labs | `grep -r "from '@/sandbox\|from '@/labs" src/` | 仅 app/router 允许 |
| 前端深层 import | `grep -r "from '@/entities/.*/.*/" src/` | 禁止，只走 index.ts |

#### 2.2 同功能二次实现

| 检查项 | 检查命令/方法 | 预期结果 |
|--------|-------------|---------|
| 旧 capability 装饰器残留 | `grep -r "CapabilityManifestProvider\|from '.*capability-decorators'" src/` | 应全部迁移到新 `CapabilityAnchorProvider` / `CapabilityRuntimeContributionProvider` |
| 旧 `CapabilityManifest` 类型 | `grep -r "CapabilityManifest" src/` | types 层中应已删除，无引用 |
| 旧 `*.port.ts` 文件 | `find src/ -name "*.port.ts"` | 禁止新增，统一 `*.contract.ts` |
| `*TransactionManager` alias | `grep -r "TransactionManager" src/` | usecases/modules 中禁止新增 |
| BullMQ 常量二次定义 | 检查 `types/worker/bullmq.types.ts` 与 `infrastructure/bullmq/bullmq.constants.ts` | types 层为真源，infrastructure 层 re-export |
| `CapabilityOperationHandler` 双重定义 | 检查 types 层与 `capability-bus.contract.ts` | types 层为宽松版本（供 modules 实现），contract 层为精确版本（供 infrastructure 使用），需注释说明 |
| 同语义 enum 重复定义 | 搜索 enum 定义是否有同名不同位置 | 单一真源 |
| 同功能 service/utility 重复 | 搜索相似命名和功能的工具函数 | 合并为单一实现 |

#### 2.3 违反 docs 规范的代码

| 检查项 | 检查命令/方法 | 预期结果 |
|--------|-------------|---------|
| ORM Entity 中有 GraphQL 装饰器 | `grep -r "@ObjectType\|@Field\|@InputType" src/modules/` | 禁止，GraphQL DTO 只在 adapters |
| ORM Entity 中有 HTTP/Swagger 装饰器 | `grep -r "@ApiProperty" src/modules/` | 禁止 |
| QueryService 中有写操作 | `grep -r "\.save(\|\.insert(\|\.update(\|\.delete(\|\.remove(" src/modules/**/queries/` | 禁止 |
| QueryService 反向调用 Usecase | `grep -r "Usecase" src/modules/**/queries/*.query.service.ts` | 仅注释中出现可接受，值导入禁止 |
| Service/QueryService 直接读取 ConfigService/process.env | `grep -r "ConfigService\|process\.env" src/modules/**/*.service.ts src/modules/**/queries/` | 禁止，只有 Module 级 provider factory 允许 |
| adapters 返回 ORM Entity | 检查 resolver/controller 返回类型 | 禁止，必须返回 View/DTO |
| modules(service) 提供全局事务入口 | `grep -r "runTransaction\|withTransaction" src/modules/` | 禁止，事务由 Usecase 持有 |
| modules 直接依赖 TransactionRunner | `grep -r "TransactionRunner" src/modules/` | 禁止 |
| Capability anchor 缺少 decisionRef | 检查所有 `@CapabilityAnchorProvider` | 必须有 `decisionRef` 指向 `docs/capabilities/*.md` |
| Capability manifest 文件有 import 副作用 | 检查 `*.capability.ts` / `*.providers.ts` | 禁止启动 Nest 容器、连接外部资源、读取业务数据 |
| Git 冲突标记残留 | `grep -r "<<<<<<< \|=======$\|>>>>>>>" src/` | 禁止 |

#### 2.4 常量值一致性

| 检查项 | 检查命令/方法 | 预期结果 |
|--------|-------------|---------|
| BullMQ 队列名在 types 和 infrastructure 层一致 | 对比 `types/worker/bullmq.types.ts` 与 `infrastructure/bullmq/bullmq.constants.ts` 的值 | 完全一致 |
| Capability ID 在 anchor 和 types 中一致 | 检查各 `*.capability.ts` 的 `capabilityId` 与对应 types 常量 | 完全一致 |
| Enum 值跨文件一致 | 对比同语义 enum 在不同位置的定义 | 单一真源 |

---

### 第三步：修复原则

1. **遵循项目规范**：所有修复必须符合 docs 中的规则，不得为了快速修复而违反分层约束
2. **单一真源**：重复定义的类型/常量/enum 保留权威位置，其他改为 re-export 或替换 import
3. **依赖方向优先**：当需要消除违规依赖时，优先将共享定义上抽到 types 层或 bounded context 根类型文件
4. **增量修复**：不进行大范围重构，仅修复本次检查发现的具体违规
5. **保留业务代码**：涉及业务逻辑的文件只做规范对齐，不删除业务功能
6. **验证修复**：每次修复后运行 `npx tsc --noEmit` 和 `npx eslint` 确保无编译/lint 错误

#### 常见修复模式

| 问题 | 修复方式 |
|------|---------|
| adapter 导入 infrastructure 实现（值导入） | 将常量/类型上抽到 types 层，adapter 改为从 `@app-types/*` 导入；runtime 函数如无法上抽，标注为已知偏差 |
| modules 导入 infrastructure 常量 | 改为从 `@app-types/*` 导入；infrastructure 层 re-export types 层定义 |
| 旧 capability 装饰器残留 | 创建新 `*.capability.ts` 使用 `CapabilityAnchorProvider`，更新 module 注册，删除旧 providers |
| 同名类型双重定义 | 保留 L1（types 层）或 L2（bounded context 根类型）为真源，contract 层如需扩展用 `extends` 或注释说明差异 |
| ORM Entity 含 GraphQL 装饰器 | 新建 adapter DTO，将 GraphQL 装饰器迁出 |
| `getTransactionEntityManager` 兼容别名 | 保留但标注为已知偏差，逐步迁移到 `getTypeOrmEntityManager` |

---

### 第四步：生成报告

输出结构清晰的检查报告，包含：

1. **总体结论**：合规状态概述
2. **已修复问题**：逐项列出问题、位置、修复方式
3. **已知偏差**：标注暂时保留的偏差项及原因
4. **待人工确认**：无法自动判断或需要业务决策的项
5. **验证结果**：TypeScript 编译 + ESLint 检查结果

---

## 典型 Bug 模式（基于历史修复经验）

以下是框架更新后常见的 Bug 模式，需特别关注：

1. **常量值分叉**：types 层与 infrastructure 层分别定义同名常量但值不同（如 `magic_item_craft` vs `magic-item-craft`），导致运行时队列不匹配
2. **装饰器模式混用**：新旧 capability 装饰器共存，旧 `CapabilityManifestProvider` 未迁移
3. **孤立代码**：框架已删除的接口/类仍存在于项目中，无任何引用
4. **类型重复定义**：同一接口在 types 层和 contract 层各有一份，签名可能不一致
5. **依赖方向违规**：modules/adapters 直接 import infrastructure 实现文件而非通过 types 层或 DI boundary contract
6. **QueryService 包含写操作**：框架升级时误将写逻辑保留在 QueryService 中
7. **Entity 污染**：GraphQL/HTTP 装饰器未从 ORM Entity 中迁出
8. **兼容别名残留**：`getTransactionEntityManager`、`*TransactionManager` 等旧别名仍被广泛使用
