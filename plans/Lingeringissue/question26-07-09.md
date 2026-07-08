# 遗留问题清单 - 2026-07-09

> 本文件记录全局架构 review 过程中发现但未能直接修复的问题。
> 标记说明：[未解决] / [已解决]

---

## 1. infrastructure → usecases boundary contracts 依赖方向未精确建模

- **状态**：[未解决]
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

- **状态**：[未解决]
- **规范依据**：`docs/common/usecase.rules.md` — "modules(service) → infrastructure / core"（允许）；但 `docs/worker/worker-adapter.rules.md` 要求 adapter 不直接依赖 infrastructure；`docs/common/boundary-contract.rules.md` 要求跨层通过 boundary contract 解耦
- **现状**：
  - `src/modules/common/email-queue/email-queue.service.ts` 直接导入 `BullMqProducerGateway`（infrastructure 层运行时类）。
  - `src/modules/common/ai-queue/ai-queue.service.ts` 直接导入 `BullMqProducerGateway`。
  - `src/modules/common/magic-item-craft-queue/magic-item-craft-queue.service.ts` 直接导入 `BullMqProducerGateway`。
  - `src/modules/common/ai-capability/ai-capability.providers.ts` 直接导入 `CapabilityManifestProvider`、`CapabilityQueueBindingProvider`（infrastructure capability decorators）。
  - `src/modules/common/email-capability/email-capability.providers.ts` 同上。
- **影响**：
  - modules 层与 infrastructure 层的具体实现（BullMQ、TypeORM）紧耦合。
  - 替换队列实现或运行时框架时需要修改 modules 层代码。
  - 与 boundary contract 模式不一致。
- **修复方案**：
  1. 在 `src/usecases/common/ports/` 或 `src/core/` 中定义 `QueueProducer` boundary contract（接口 + DI token）。
  2. 在 infrastructure 层提供 `BullMqQueueProducer` 实现。
  3. 将 modules 中的 queue service 改为依赖 `QueueProducer` contract 而非 `BullMqProducerGateway`。
  4. 对于 capability decorators，参考 reference 模块的迁移模式，将声明/注册类留在 modules 层但将 decorator 函数通过 boundary contract 或 types 层暴露。
- **涉及文件**：
  - `src/modules/common/email-queue/email-queue.service.ts`
  - `src/modules/common/ai-queue/ai-queue.service.ts`
  - `src/modules/common/magic-item-craft-queue/magic-item-craft-queue.service.ts`
  - `src/modules/common/ai-capability/ai-capability.providers.ts`
  - `src/modules/common/email-capability/email-capability.providers.ts`
  - 新增：`QueueProducer` contract 及其 infrastructure 实现
- **风险**：
  - 涉及多个 bounded context 的队列服务重构，回归风险较高。
  - 需要确保 `QueueProducer` contract 足够通用以覆盖所有队列场景（普通入队、延迟入队、优先级入队等）。
  - Capability decorator 的解耦需要更深入的设计，可能需要将 decorator 注册机制改为 DI-based。

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
