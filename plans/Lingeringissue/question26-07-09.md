# 遗留问题清单 - 2026-07-09

> 本文件记录全局架构 review 过程中发现但未能直接修复的问题。
> 标记说明：[未解决] / [已解决]

---

## 1. infrastructure → usecases boundary contracts 依赖方向未精确建模

- **状态**：[已解决]
- **修复**：
  - 在 ESLint boundaries 元素定义中新增 `usecases-contracts` 元素类型，pattern 匹配 `src/usecases/common/ports/*.contract.ts`。
  - 在 infrastructure 的 allow 规则中增加 `{ to: { type: 'usecases-contracts' } }`，允许 infrastructure 合法实现 usecase-owned boundary contract。
  - 为 `usecases-contracts` 配置自身依赖约束：只允许依赖 types、core，禁止依赖其他层。
- **规范依据**：`docs/common/usecase.rules.md` — usecase-owned boundary contract 可由 infrastructure 实现；`docs/common/eslint-architecture-rules.md` — ESLint boundaries 插件应精确建模层间依赖
- **现状**：
  - infrastructure 层大量文件从 `@src/usecases/common/ports/*.contract.ts` 导入 DI token 和接口类型（如 `CAPABILITY_QUEUE_CONSUMER`、`TransactionRunner`、`CapabilityRequestContextStore` 等）。
  - 这些依赖是合法的依赖倒置（DIP）：infrastructure 实现 usecase 拥有的 boundary contract。
  - 当前 ESLint `boundaries/dependencies` 规则中 infrastructure 不允许依赖 usecases，导致合法的 contract 实现依赖被误报或无法被正确检测。
- **影响**：
  - 如果强制执行当前 ESLint 规则，会阻断合法的 contract 实现。
  - 如果不执行，则无法检测真正的违规（如 infrastructure 直接调用 usecase 业务逻辑）。
- **修复方案**：
  1. 在 ESLint 元素定义中新增 `usecases-contracts` 元素类型，pattern 匹配 `src/usecases/common/ports/*.contract.ts`。
  2. 在 infrastructure 的 allow 规则中增加 `{ to: { type: 'usecases-contracts' } }`。
  3. 确保 `usecases-contracts` 只包含 contract 定义（接口、Symbol token、最小共享类型），不包含业务逻辑实现。
  4. 为 `usecases-contracts` 配置自身的依赖约束：只允许依赖 types、core。
- **涉及文件**：
  - `eslint.config.mjs` — 元素定义与规则配置
  - 可能需要调整 `src/usecases/` 下的文件分类逻辑
- **风险**：
  - ESLint 配置变更影响全项目，需要充分测试。
  - 需确保 `usecases-contracts` 元素 pattern 不会误匹配非 contract 文件。

---

## 2. modules 层对 infrastructure 的运行时依赖

- **状态**：[已解决]
- **修复**：
  - 新增 `QueueProducer` boundary contract（`src/usecases/common/ports/queue-producer.contract.ts`），定义 `enqueue`/`hasJob`/`checkQueueAvailable` 接口和 `QUEUE_PRODUCER` DI token。
  - `BullMqModule` 通过 `useExisting` 将 `BullMqProducerGateway` 绑定到 `QUEUE_PRODUCER` token。
  - 三个 queue service（email/ai/magic-item-craft）改为注入 `@Inject(QUEUE_PRODUCER) QueueProducer` 而非直接依赖 `BullMqProducerGateway`。
  - 将 capability decorators（`@CapabilityManifestProvider`、`@CapabilityQueueBindingProvider`、`@CapabilityOperationHandlerProvider` 等）从 `src/infrastructure/capability/capability.decorators.ts` 迁移到 `src/types/common/capability-decorators.ts`，modules 层改为从 `@app-types/common/capability-decorators` 导入，消除了 modules 对 infrastructure capability decorators 的直接依赖。
  - infrastructure 层的 `capability.decorators.ts` 改为从 types 层 re-export，保持向后兼容。
  - 新增 `ProviderRegistry` boundary contract（`src/usecases/common/ports/provider-registry.contract.ts`），解耦 `AiProviderRegistry` 对 `CapabilityRegistry` 的直接依赖。
  - `CapabilityModule` 通过 `useExisting` 将 `CapabilityRegistry` 绑定到 `PROVIDER_REGISTRY` token。
  - `AiProviderRegistry` 改为注入 `@Inject(PROVIDER_REGISTRY) ProviderRegistry` 而非直接依赖 `CapabilityRegistry`。
  - 新增 `TypeOrmPaginationModule`（`src/infrastructure/typeorm/pagination/typeorm-pagination.module.ts`），将 `HmacCursorSigner`、`TypeOrmPaginator`、`TypeOrmSort` 的 DI wiring 下沉到 infrastructure 层。`PaginationModule` 改为导入 `TypeOrmPaginationModule`，不再直接导入具体实现类。
  - 将 `PAGINATION_TOKENS` 从 `src/modules/common/tokens/pagination.tokens.ts` 提升到 `src/core/pagination/pagination.tokens.ts`，modules 层改为 re-export。
  - 新增 `TypeOrmSearchModule`（`src/infrastructure/typeorm/search/typeorm-search.module.ts`），将 `TypeOrmSearch` 的 DI wiring 下沉到 infrastructure 层。`SearchModule` 改为导入 `TypeOrmSearchModule`，不再直接导入 `TypeOrmSearch`。
  - 新增 `BlogStorageModule`（`src/infrastructure/blog-storage/blog-storage.module.ts`），将 `CravatarAvatarGeneratorAdapter`、`LocalFileStorageAdapter`、`BlogUploadConfigProvider` 的 DI wiring 下沉到 infrastructure 层。`BlogModule` 改为导入 `BlogStorageModule`，不再直接导入具体实现类。
- **剩余**：
  - `.module.ts` 中仍有 infrastructure module 的导入（`BullMqModule`、`FieldEncryptionModule`、`CoreJwtModule`、`AiInfrastructureModule`、`ThirdPartyAuthInfrastructureModule`、`TypeOrmPaginationModule`、`TypeOrmSearchModule`、`BlogStorageModule`），属于 NestJS composition root 模式，ESLint 已允许，无需进一步解耦。
- **规范依据**：`docs/common/usecase.rules.md` — "modules(service) → infrastructure / core"（允许）；但 `docs/worker/worker-adapter.rules.md` 要求 adapter 不直接依赖 infrastructure；`docs/common/boundary-contract.rules.md` 要求跨层通过 boundary contract 解耦
- **现状**：
  - 已修复：modules 层的 service 类（queue service、ai-provider-registry）已通过 boundary contract 解耦对 infrastructure 的直接依赖。
  - 已修复：capability decorators 已迁移到 types 层，modules 层不再直接导入 infrastructure 的 decorator 文件。
  - 已修复：`PaginationModule`、`SearchModule`、`BlogModule` 不再直接导入 infrastructure 具体实现类，改为导入 infrastructure module。
  - 已修复：`PAGINATION_TOKENS` 已提升到 core 层，infrastructure 可直接导入。
  - 已修复：`getTypeOrmEntityManager` 和 `PersistenceTransactionContext` 已迁移到 types 层（`src/types/common/transaction.types.ts`），16 个 service 文件改为从 `@app-types/common/transaction.types` 导入，不再直接依赖 infrastructure 层。
  - 已修复：`registerEncryptedField` 已迁移到 types 层（`src/types/common/field-encryption.metadata.ts`），`account-field-encryption.registrar.ts` 改为从 types 层导入。
  - 剩余：`.module.ts` 中导入 infrastructure module（composition root，ESLint 已允许，无需进一步解耦）。
- **影响**：
  - 核心业务 service 层已通过 boundary contract 和 types 层抽象完全解耦，替换队列/AI/事务/加密实现不再需要修改 modules 层 service 代码。
  - `.module.ts` 中的 DI 组装已通过 infrastructure module 封装，替换 TypeORM/BullMQ 实现只需修改 infrastructure 层 module。
  - `getTypeOrmEntityManager` 已通过 `PersistenceTransactionContext` branded type 和 WeakMap 映射抽象，modules 层不再直接依赖 TypeORM `EntityManager` 类型。
- **修复方案**：
  1. ~~在 `src/usecases/common/ports/` 或 `src/core/` 中定义 `QueueProducer` boundary contract~~ ✅ 已完成
  2. ~~在 infrastructure 层提供 `BullMqQueueProducer` 实现~~ ✅ 已完成（通过 `useExisting` 绑定）
  3. ~~将 modules 中的 queue service 改为依赖 `QueueProducer` contract~~ ✅ 已完成
  4. ~~对于 capability decorators，将 decorator 函数通过 types 层暴露~~ ✅ 已完成
  5. ~~创建 `ProviderRegistry` boundary contract，解耦 `AiProviderRegistry` 对 `CapabilityRegistry` 的依赖~~ ✅ 已完成
  6. ~~对于 `.module.ts` DI 组装层的耦合，将具体实现的 DI 注册移入 infrastructure 层的 module~~ ✅ 已完成（`TypeOrmPaginationModule`、`TypeOrmSearchModule`、`BlogStorageModule`）
  7. ~~将 `PAGINATION_TOKENS` 提升到 core 层~~ ✅ 已完成
  8. ~~将 `getTypeOrmEntityManager` 和 `PersistenceTransactionContext` 迁移到 types 层，通过 branded type + WeakMap 抽象事务上下文~~ ✅ 已完成
  9. ~~将 `registerEncryptedField` 迁移到 types 层~~ ✅ 已完成
- **涉及文件**：
  - `src/types/common/capability-decorators.ts` — 新增：capability decorators 迁移目标
  - `src/infrastructure/capability/capability.decorators.ts` — 改为从 types 层 re-export
  - `src/infrastructure/capability/capability.registry.ts` — 改为从 types 层导入 decorator metadata
  - `src/infrastructure/capability/capability.module.ts` — 注册 `PROVIDER_REGISTRY` token
  - `src/usecases/common/ports/queue-producer.contract.ts` — 新增：QueueProducer boundary contract
  - `src/usecases/common/ports/provider-registry.contract.ts` — 新增：ProviderRegistry boundary contract
  - `src/modules/common/ai-worker/providers/ai-provider-registry.ts` — 改为注入 ProviderRegistry
  - `src/modules/common/ai-capability/ai-capability.providers.ts` — 改为从 types 层导入 decorator
  - `src/modules/common/email-capability/email-capability.providers.ts` — 改为从 types 层导入 decorator
  - `src/modules/reference/reference-capability.providers.ts` — 改为从 types 层导入 decorator
  - `src/infrastructure/typeorm/pagination/typeorm-pagination.module.ts` — 新增：TypeORM 分页 DI wiring module
  - `src/infrastructure/typeorm/search/typeorm-search.module.ts` — 新增：TypeORM 搜索 DI wiring module
  - `src/infrastructure/blog-storage/blog-storage.module.ts` — 新增：Blog 存储 DI wiring module
  - `src/core/pagination/pagination.tokens.ts` — 新增：PAGINATION_TOKENS 提升到 core 层
  - `src/modules/common/pagination.module.ts` — 改为导入 TypeOrmPaginationModule
  - `src/modules/common/search.module.ts` — 改为导入 TypeOrmSearchModule
  - `src/modules/blog/blog.module.ts` — 改为导入 BlogStorageModule
- **风险**：
  - ✅ 已缓解：队列服务重构已完成，`QueueProducer` contract 已覆盖所有队列场景。
  - ✅ 已缓解：Capability decorator 已迁移到 types 层，modules 不再直接依赖 infrastructure decorator。
  - 剩余：`.module.ts` DI 组装的进一步解耦需要更全面的设计评估，风险可控。

---

## 已修复问题记录

### 3. usecases 层违规依赖 infrastructure 层

- **状态**：[已解决]
- **修复**：将 reference capability 声明和 handler 从 `src/usecases/reference/` 迁移到 `src/modules/reference/`。

### 4. 跨层协议接口位置不当

- **状态**：[已解决]
- **修复**：将 `CapabilityOperationHandler` 和 `CapabilityEventSubscriber` 接口提升到 `src/types/common/capability.types.ts`，`capability-bus.contract.ts` 改为重新导出。

### 5. adapters/worker 违规依赖 infrastructure 层

- **状态**：[已解决]
- **修复**：
  - 将 `BULLMQ_QUEUES`/`BULLMQ_JOBS` 常量提升到 `src/types/worker/bullmq.types.ts`。
  - 将 `CapabilityDispatchJobPayload`/`restoreCapabilityEnvelope` 提升到 `src/types/worker/capability-queue.types.ts`。
  - 更新所有 adapters/worker 和 modules 中的违规导入路径。
