# 遗留问题清单 - 2026-07-15 (全局架构检查)

> 本文件记录全局架构检查（`plans/check/global-architecture-check.md`）过程中发现的问题。
> 标记说明：[未解决] / [已解决]

---

## 1. 跨域 Usecase 依赖：`login-with-user-info.usecase.ts` 从 auth 域依赖 account 域

- **状态**：[已解决] — 已改为 DI 注入 AccountQueryService/AccountSecurityService，不再跨域依赖 FetchUserInfoUsecase
- **规范依据**：`docs/common/usecase.rules.md` — "usecases → usecases 仅限同域编排型依赖"；ESLint 规则 `local-architecture/no-cross-domain-usecases-imports`
- **现状**：
  - `src/usecases/auth/login-with-user-info.usecase.ts` 从 `../account/fetch-user-info.types` 和 `../account/fetch-user-info.usecase` 导入，属于 auth 域对 account 域的跨域依赖。
  - ESLint 已报告此违规（2 个 error）。
  - `LoginWithUserInfoUsecase` 组合了 `LoginWithPasswordUsecase`（auth 域）、`LoginWithThirdPartyUsecase`（auth 域）和 `FetchUserInfoUsecase`（account 域）。
- **影响**：
  - 违反跨域 usecase 依赖禁令。
  - 虽然 `LoginWithUserInfoUsecase` 的意图是"避免 Resolver 做业务编排"（原来是 Resolver 编排两个 Usecase），但当前实现方式不符合 usecase 跨域规则。
- **修复方案**（待评估）：
  1. **方案 A**：将 `FetchUserInfoUsecase` 的必要输出抽象为 account 域的稳定 contract type，`LoginWithUserInfoUsecase` 改为通过 DI 注入 account 域的 QueryService 或 service 获取用户信息，而非直接依赖另一个 usecase。
  2. **方案 B**：在 auth 域内新增一个薄 adapter，通过 DI 调用 account 域的 service/QueryService，使 auth usecase 只依赖 modules 层而非跨域 usecase。
  3. **方案 C**：将 login + fetchUserInfo 的编排提升为独立的跨域协调 usecase，但需明确其归属的 bounded context。
- **涉及文件**：
  - `src/usecases/auth/login-with-user-info.usecase.ts`
  - `src/usecases/account/fetch-user-info.usecase.ts`
  - `src/usecases/account/fetch-user-info.types.ts`
- **风险**：
  - 修改编排方式可能影响登录流程的返回结构。
  - 需确保 Resolver 不因此恢复为多 usecase 编排模式。

---

## 2. Service 对上游返回 Entity 类型（B2 盲区）

- **状态**：[已解决] — account.service.ts 公开方法已改为返回 Snapshot（saveAccountEntity/saveUserInfoEntity 改为 private，lockByIdForUpdate 返回 AccountSnapshot）；ai-workflow-context/ai-provider-call-record 的 Entity 返回方法已改为 private
- **规范依据**：`docs/common/entity.rules.md` — "modules(service) 对上游不得返回 ORM Entity"；`docs/common/modules.rules.md` — "modules(service) 对上游提供 View、ReadModel、Record snapshot"
- **现状**：
  - `src/modules/account/base/services/account.service.ts`：
    - `saveAccount()` 返回 `Promise<AccountEntity>`（第 124 行）
    - `lockByIdForUpdate()` 返回 `Promise<AccountEntity>`（第 191 行）
    - `saveUserInfo()` 返回 `Promise<UserInfoEntity>`（第 220 行）
  - `src/modules/ai-workflow-context/ai-workflow-context.service.ts`：
    - `requireEntityByWorkflowId()` 返回 `Promise<AiWorkflowContextEntity>`（第 764 行）
  - `src/modules/ai-provider-call-record/ai-provider-call-record.service.ts`：
    - `createRecordWithAllocatedSeq()` 返回 `Promise<AiProviderCallRecordEntity>`（第 208 行）
  - 这些 Entity 类型通过方法返回值隐式传播到 Usecase 层，导致 Usecase 持有并操作 Entity 字段。
- **影响**：
  - Usecase 直接读取 Entity 字段（如 `savedAccount.id`、`savedAccount.createdAt`），违反"Usecase 不得 import 或短暂持有 ORM Entity"规则。
  - Entity 类型变更会跨层波及到 Usecase。
  - 部分 Service（如 `AccountService.createAndSaveAccount()`）已正确返回 snapshot 类型 `AccountCreateResult`，但其他方法未跟进。
- **修复方案**（待评估）：
  1. 为每个返回 Entity 的公开方法新增对应的 snapshot/View 返回类型，只暴露上游需要的字段。
  2. 对于 `lockByIdForUpdate()` 等内部使用 Entity 的方法，检查调用方是否在同一 service 内部；若仅内部使用则可保留，但需标注为 private 或在注释中说明。
  3. 对于 `saveAccount()` 等被 Usecase 调用的方法，必须返回 snapshot 而非 Entity。
- **涉及文件**：
  - `src/modules/account/base/services/account.service.ts`
  - `src/modules/ai-workflow-context/ai-workflow-context.service.ts`
  - `src/modules/ai-provider-call-record/ai-provider-call-record.service.ts`
  - 调用这些方法的 Usecase 文件
- **风险**：
  - 需逐一确认每个 Usecase 实际使用的 Entity 字段，确保 snapshot 包含必要数据。
  - 部分内部方法可能因事务内需要完整 Entity 操作而保留 Entity 返回类型。

---

## 3. QueryService mapper 参数接受 Entity 类型（B2 盲区）

- **状态**：[已解决] — verification-read.query.service.ts 的 toCleanView/toDetailView 已改为仅接受 VerificationRecordSnapshot
- **规范依据**：`docs/common/queryservice.rules.md` — "QueryService 对外禁止返回 ORM Entity 或 QueryBuilder"；`docs/common/entity.rules.md` — Entity 对外输出应为 View/ReadModel
- **现状**：
  - `src/modules/verification-record/queries/verification-read.query.service.ts`：
    - `toCleanView(record: VerificationRecordEntity | VerificationRecordSnapshot)` — 参数接受 Entity
    - `toDetailView(record: VerificationRecordEntity | VerificationRecordSnapshot)` — 参数接受 Entity
  - 这使得 Usecase 可以将 Service 返回的 Entity 直接传给 QueryService 的 mapper，隐式传播了 Entity 依赖。
- **影响**：
  - QueryService mapper 参数类型同时接受 Entity 和 Snapshot，导致 Usecase 有动机持有 Entity 并传递给 QueryService。
  - 若 mapper 只接受 Snapshot，则 Usecase 必须先做 Entity→Snapshot 转换，阻断 Entity 跨层传播。
- **修复方案**（待评估）：
  1. 将 `toCleanView` / `toDetailView` 的参数类型收窄为仅接受 `VerificationRecordSnapshot`。
  2. 在 Service 层新增 Entity→Snapshot 转换方法，供 Usecase 在调用 QueryService 前使用。
  3. 或在 Usecase 层通过 Service 的 snapshot 返回方法获取数据，而非持有 Entity。
- **涉及文件**：
  - `src/modules/verification-record/queries/verification-read.query.service.ts`
  - `src/modules/verification-record/queries/verification-record.query.service.ts`
- **风险**：
  - 修改 mapper 参数类型会影响所有调用方，需逐一适配。

---

## 4. Resolver catch 吞非 DomainError 异常（B4 盲区）

- **状态**：[已解决] — account.resolver.ts 和 verification-record.resolver.ts 的 create/consume/revoke 操作已移除 try-catch；findVerificationRecord 的 catch { return null } 也已移除
- **规范依据**：`docs/api/adapters.rules.md` — "入参解析、输出结构映射与错误码透传"；全局 GraphQL 错误契约 — "DomainError 应冒泡到全局 Filter"
- **现状**：
  - `src/adapters/api/graphql/verification-record/verification-record.resolver.ts`：
    - `createVerificationRecord()` catch 后对非 DomainError 返回 `{ success: false, message: ... }`（第 89-97 行）
    - `consumeVerificationRecord()` catch 后返回 `{ success: false, ... }`（第 175-183 行）
    - `revokeVerificationRecord()` catch 后返回 `{ success: false, ... }`（第 222-228 行）
  - `src/adapters/api/graphql/account/account.resolver.ts`：
    - `resetPassword()` catch 后返回 `{ success: false, message: ... }`（第 80-86 行）
  - 这些 catch 块中，DomainError 已正确冒泡，但非 DomainError 异常被吞掉，返回结构化响应绕过了全局 GraphQL 错误过滤器。
  - 更严重的是，`account.resolver.ts` 的 catch 将 `error.message` 直接暴露给客户端（`密码重置失败：${error.message}`），可能泄露内部错误细节。
- **影响**：
  - 非 DomainError 异常被吞掉后，全局 Filter 无法统一处理，前端无法通过 `errors[].extensions.code` 判断错误类别。
  - `error.message` 泄露违反安全规则。
  - 绕过了全局错误契约，前端需要同时处理 GraphQL errors 和 mutation result 中的 success=false 两种错误模式。
- **修复方案**（待评估）：
  1. 移除 Resolver 中的 try-catch，让所有异常冒泡到全局 GraphQL Filter。
  2. 或在 catch 中对非 DomainError 也抛出，不返回结构化 `success: false` 响应。
  3. 绝不在 catch 中将 `error.message` 直接暴露给客户端。
  4. 调整 mutation 的返回类型设计，将业务错误改为 DomainError 抛出，成功走正常返回。
- **涉及文件**：
  - `src/adapters/api/graphql/verification-record/verification-record.resolver.ts`
  - `src/adapters/api/graphql/account/account.resolver.ts`
- **风险**：
  - 修改错误处理策略会改变前端感知错误的方式，需与前端协调。
  - 当前 `success: false` 返回模式可能是前端已依赖的契约，变更前需确认前端兼容性。

---

## 5. `capability-bus.contract.ts` 保留完整通用 Command/Query/Event Bus 抽象（B5 盲区）

- **状态**：[部分解决] — CapabilityCommandBus/QueueTransport/QueueConsumer/EventPublisher/PermissionChecker 已移除，CAPABILITY 队列和 capability-queue.runtime.ts 已移除；仅保留 CapabilityQueryBus（因 DispatcherReferenceProfileClient 消费方）
- **规范依据**：`docs/common/capability.rules.md` — "Do not add a generic capabilities layer or runtime bus that wraps ordinary calls"；"Cross-capability business calls use an existing owner-facing surface or a narrow typed contract; no generic dispatcher or envelope is required"
- **现状**：
  - `src/usecases/common/ports/capability-bus.contract.ts` 定义了完整的通用 Bus 抽象：
    - `CapabilityCommandBus`（execute 方法）
    - `CapabilityQueryBus`（ask 方法）
    - `CapabilityQueueTransport`（enqueue 方法）
    - `CapabilityQueueConsumer`（consume 方法）
    - `CapabilityEventPublisher` / `CapabilityEventSubscriber`
    - `CapabilityPermissionChecker`
    - 以及大量泛型 envelope 类型（`CapabilityDispatchInput`、`CapabilityCommandInput`、`CapabilityQueryInput`）
  - 这些抽象与 Capability 规则明确禁止的"generic dispatcher or envelope"一致。
  - 唯一的消费方是 `src/infrastructure/capability/reference-profile.client.ts`，通过 `CAPABILITY_QUERY_BUS` 调用 `ask` 方法。
  - `src/infrastructure/bullmq/queue-registry.ts` 仍注册 `CAPABILITY` 队列，以及 `src/infrastructure/bullmq/contracts/capability-queue.runtime.ts` 保留 CAPABILITY dispatch payload contract。
- **影响**：
  - 通用 Bus 抽象是规则明确禁止的模式，存在被滥用的风险。
  - CAPABILITY 队列注册缺少对应的 Capability 决策（`docs/capabilities/current.md` 中无 `capability` 这个 ID）。
  - 若未来有新的跨 capability 调用需求，开发者可能直接使用 Bus 而非遵循"现有 owner-facing surface 或窄类型 contract"的规则。
- **修复方案**（待评估）：
  1. 将 `DispatcherReferenceProfileClient` 改为直接调用 reference-profile 的窄类型 contract（如 `ReferenceProfileClient`），移除对 `CapabilityQueryBus` 的依赖。
  2. 废弃 `capability-bus.contract.ts` 中的通用 Bus 抽象，保留真正被使用的窄接口。
  3. 移除 `queue-registry.ts` 中的 CAPABILITY 队列注册和 `capability-queue.runtime.ts`。
  4. 移除 `src/types/worker/bullmq.types.ts` 中的 `CAPABILITY` 队列名和 job 名常量。
- **涉及文件**：
  - `src/usecases/common/ports/capability-bus.contract.ts`
  - `src/infrastructure/capability/reference-profile.client.ts`
  - `src/infrastructure/capability/reference-profile-client.module.ts`
  - `src/infrastructure/bullmq/queue-registry.ts`
  - `src/infrastructure/bullmq/contracts/capability-queue.runtime.ts`
  - `src/infrastructure/bullmq/contracts/job-contract.registry.ts`
  - `src/types/worker/bullmq.types.ts`
- **风险**：
  - 需确保 `ReferenceProfileClient` 有其他可用的窄类型实现路径。
  - CAPABILITY 队列可能已有积压 job，移除前需确认清空或迁移。

---

## 6. `notification.email` / `notification.email.sendmail` Capability ID 未在决策文档中声明（B5 盲区）

- **状态**：[已解决] — 已在 `docs/capabilities/current.md` 中声明 notification.email 和 notification.email.sendmail
- **规范依据**：`docs/common/capability.rules.md` — "Creating, splitting, merging, deleting, renaming, reclassifying, or changing the mode of a capability is a semantic governance decision. It requires an accepted decision under `docs/capabilities/`"
- **现状**：
  - `src/modules/common/email-capability/email-capability.constants.ts` 定义了：
    - `NOTIFICATION_EMAIL_CAPABILITY_ID = 'notification.email'`
    - `NOTIFICATION_EMAIL_SENDMAIL_CAPABILITY_ID = 'notification.email.sendmail'`
  - 这两个 ID 在 `docs/capabilities/current.md` 中未声明。
  - `docs/capabilities/current.md` 声明的是 `runtime.email-delivery`，而非 `notification.email`。
  - 同时存在 `RUNTIME_EMAIL_DELIVERY_CAPABILITY_ID = 'runtime.email-delivery'`，与决策文档一致，但 `notification.email` 系列作为并行 ID 存在。
- **影响**：
  - Capability ID 未经治理决策即存在，违反 Capability admission 规则。
  - `notification.email` 和 `runtime.email-delivery` 可能语义重叠，造成混乱。
  - 运行时 registry 会同时注册两组 ID，增加维护复杂度。
- **修复方案**（待评估）：
  1. 确认 `notification.email` / `notification.email.sendmail` 与 `runtime.email-delivery` 的关系。
  2. 若 `notification.email` 系列已废弃，移除其 Anchor 和相关装饰器，统一使用 `runtime.email-delivery`。
  3. 若 `notification.email` 需要保留，必须在 `docs/capabilities/` 中补充决策文档。
- **涉及文件**：
  - `src/modules/common/email-capability/email-capability.constants.ts`
  - `src/modules/common/email-worker/email-sendmail.capability.ts`
  - `docs/capabilities/current.md`
- **风险**：
  - ID 合并或废弃可能影响运行时 capability registry 和 health check。
  - 需确认 Worker 激活逻辑是否依赖这些 ID。

---

## 7. `ai.provider-call-observation` Capability ID 未在决策文档中声明（B5 盲区）

- **状态**：[已解决] — 已在 `docs/capabilities/current.md` 中声明 ai.provider-call-observation
- **规范依据**：`docs/common/capability.rules.md` — Capability admission 需要决策文档
- **现状**：
  - `src/modules/ai-provider-call-record/ai-provider-call-observation.capability.ts` 定义了 `AI_PROVIDER_CALL_OBSERVATION_CAPABILITY_ID = 'ai.provider-call-observation'`。
  - `docs/capabilities/current.md` 中仅有 `ai.execution` 和 `ai.workflow`，无 `ai.provider-call-observation`。
  - 该 Anchor 声明为 `always-on`，requires 为空。
- **影响**：
  - Capability ID 未经治理决策，存在漂移风险。
  - 与 `ai.execution` 的关系不明确——按决策文档，"provider-call observation"属于 `ai.execution` 的职责范围。
- **修复方案**（待评估）：
  1. 在 `docs/capabilities/current.md` 中补充 `ai.provider-call-observation` 的决策，或将其合并到 `ai.execution` 下。
  2. 若合并，移除独立 Anchor，将 call-record 观察能力归入 `ai.execution` 的 RuntimeContribution。
- **涉及文件**：
  - `src/modules/ai-provider-call-record/ai-provider-call-observation.capability.ts`
  - `docs/capabilities/current.md`
- **风险**：
  - 影响范围较小，该 capability 为 always-on 且无 switchable gate。

---

## 8. `src/types/common/transaction.types.ts` 从 infrastructure 层 re-export（B6 盲区）

- **状态**：[已解决] — re-export 已移除，仅保留 PersistenceTransactionContext 接口
- **规范依据**：`docs/common/type.rules.md` — "types 应无框架运行时副作用"；`docs/common/core.rules.md` — "core 禁止依赖任何上游层"；types 层同样不应依赖 infrastructure 实现
- **现状**：
  - `src/types/common/transaction.types.ts` 第 9 行：
    ```typescript
    export { getTypeOrmEntityManager as getTransactionEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
    ```
  - types 层从 infrastructure 层 re-export 了 `getTypeOrmEntityManager`，违反 types 层不得依赖 infrastructure 的规则。
  - 该 re-export 被 blog 域大量使用（blog service 和 QueryService 共 20+ 处引用）。
  - 注释标记为 `[KEPT:业务保留]`。
- **影响**：
  - types 层引入了对 infrastructure 实现的运行时依赖，破坏了 types 作为"稳定无框架契约"的定位。
  - 所有从 `@app-types/common/transaction.types` 导入 `getTransactionEntityManager` 的模块，间接依赖了 infrastructure。
  - blog 域大量使用该 re-export，blog service/QueryService 通过 types 层间接访问了 infrastructure 的 TypeORM helper。
- **修复方案**（待评估）：
  1. 将 `getTransactionEntityManager` 的导入路径从 `@app-types/common/transaction.types` 改为直接从 `@src/infrastructure/database/transaction/typeorm-persistence-transaction-context` 导入。
  2. 从 `transaction.types.ts` 中移除该 re-export。
  3. `PersistenceTransactionContext` 类型定义本身可以保留在 types 层（它是 framework-free 的）。
- **涉及文件**：
  - `src/types/common/transaction.types.ts`
  - 所有导入 `getTransactionEntityManager` 的 blog 域文件（约 15+ 个文件）
- **风险**：
  - 批量修改导入路径，需确认 ESLint 依赖方向规则允许 modules 直接从 infrastructure 导入。
  - 当前 `getTransactionEntityManager` 在 blog QueryService 中被使用，QueryService 依赖 infrastructure 查询实现是规则允许的，但需确认路径是否通过 lint。

---

## 9. `src/types/response.types.ts` 仅被 infrastructure middleware 使用（B6 盲区）

- **状态**：[已解决] — 文件已移至 `src/infrastructure/middleware/response.types.ts`
- **规范依据**：`docs/common/type.rules.md` — L1 共享类型需"跨 2 个及以上 bounded context 复用"；"不含 adapter 细节"
- **现状**：
  - `src/types/response.types.ts` 定义了 `ApiResponse` 和 `ShowType`，这是 Ant Design Pro 风格的统一响应格式。
  - 唯一的使用者是 `src/infrastructure/middleware/format-response.middleware.ts`。
  - 该类型包含 Ant Design Pro 特有的 `showType`/`errorCode`/`errorMessage` 等字段，属于特定 UI 框架的响应约定。
  - 不属于跨 bounded context 稳定契约，而是 infrastructure middleware 的协议适配类型。
- **影响**：
  - types 层承载了单层单消费者的协议适配类型，违反了"稳定上收"原则和"就近优先"原则。
  - `ShowType` 枚举值与 Ant Design Pro 强绑定，不具备领域语义稳定性。
- **修复方案**（待评估）：
  1. 将 `ApiResponse` 和 `ShowType` 移入 `src/infrastructure/middleware/` 附近 collocate。
  2. 或移入 `src/types/` 的 infrastructure 子目录但标记为 adapter 协议类型（需评估是否引入新的 types 子分类）。
- **涉及文件**：
  - `src/types/response.types.ts`
  - `src/infrastructure/middleware/format-response.middleware.ts`
- **风险**：
  - 影响范围极小，仅 1 个消费者。

---

## 10. `src/types/worker/bullmq.types.ts` 承载 BullMQ 队列名常量（B6 盲区）

- **状态**：[已解决] — 常量已移至 `src/infrastructure/bullmq/bullmq.constants.ts`，CAPABILITY 相关已移除
- **规范依据**：`docs/common/infrastructure.rules.md` — "Infrastructure runtime contract 文件不得使用 `*.contract.ts` 后缀；优先使用 `*.runtime.ts`、`*.payload.ts` 或 `*.registry.ts`"；`docs/common/type.rules.md` — types 应为"稳定无框架契约"，不承载 framework 常量
- **现状**：
  - `src/types/worker/bullmq.types.ts` 定义了 `BULLMQ_QUEUES` 和 `BULLMQ_JOBS` 常量，包括 CAPABILITY 队列名。
  - infrastructure 层的 `bullmq.constants.ts` 从该文件 re-export。
  - modules 层（如 `ai-queue.service.ts`、`email-queue.service.ts`）从 `@src/infrastructure/bullmq/bullmq.constants` 导入，形成 modules → infrastructure 的依赖（这在当前规则下对 queue 常量是允许的）。
  - 但 types 层承载 BullMQ 运行时常量，与"infrastructure registry 是 runtime 真源"的规则矛盾。
- **影响**：
  - types 层承载了 framework-specific 的运行时常量，违反"types 应无框架运行时副作用"。
  - CAPABILITY 队列名常量（`BULLMQ_QUEUES.CAPABILITY`）在 types 层定义，但该队列缺少对应 Capability 决策。
- **修复方案**（待评估）：
  1. 将 `BULLMQ_QUEUES` 和 `BULLMQ_JOBS` 常量移入 `src/infrastructure/bullmq/` 下作为唯一真源。
  2. modules 层继续从 `@src/infrastructure/bullmq/bullmq.constants` 导入（当前部分已如此）。
  3. 从 `src/types/worker/bullmq.types.ts` 中移除这些运行时常量，保留纯类型定义（如 `BullMqQueueName`）。
  4. 移除 CAPABILITY 相关队列常量。
- **涉及文件**：
  - `src/types/worker/bullmq.types.ts`
  - `src/infrastructure/bullmq/bullmq.constants.ts`
- **风险**：
  - 需确认无其他层通过 `@app-types/worker/bullmq.types` 导入常量值。

---

## 11. `src/types/models/registration.types.ts` 仅服务单个注册流程（B6 盲区）

- **状态**：[已解决] — 文件已移至 `src/usecases/registration/registration.types.ts`
- **规范依据**：`docs/common/type.rules.md` — L3 局部类型"仅服务于单个业务流程"应 collocate；L1 入库门槛"是否跨域复用"
- **现状**：
  - `src/types/models/registration.types.ts` 定义了 `RegisterWithEmailParams` 和 `RegisterWithEmailResult`。
  - 唯一的使用者是 `src/usecases/registration/register-with-email.usecase.ts`。
  - 该类型仅服务于单个 Usecase，不属于跨域复用的稳定契约。
- **影响**：
  - 单流程类型放在 `src/types` 导致全局共享层膨胀。
  - 违反"就近优先"和"先可演进后抽象"原则。
- **修复方案**（待评估）：
  1. 将 `RegisterWithEmailParams` 和 `RegisterWithEmailResult` 移入 `src/usecases/registration/` 下 colocate。
  2. 或保留在 `src/types/models/registration.types.ts` 但标记为待迁移。
- **涉及文件**：
  - `src/types/models/registration.types.ts`
  - `src/usecases/registration/register-with-email.usecase.ts`
- **风险**：
  - 影响范围极小，仅 1 个消费者。

---

## 12. modules 层从 infrastructure 导入 BullMQ 常量

- **状态**：[已缓解] — 常量已归 infrastructure 层为唯一真源，modules→infrastructure 常量导入在当前 ESLint 规则下合规
- **规范依据**：`docs/common/modules.rules.md` — "modules(service) 可依赖 infrastructure"；但当前 modules 从 infrastructure 非边界文件导入运行时常量，而非通过边界契约
- **现状**：
  - 多个 modules 文件从 `@src/infrastructure/bullmq/bullmq.constants` 导入 `BULLMQ_QUEUES` 和 `BULLMQ_JOBS`：
    - `src/modules/common/ai-queue/ai-queue.service.ts`
    - `src/modules/common/email-queue/email-queue.service.ts`
    - `src/modules/common/email-worker/email-delivery.service.ts`
    - `src/modules/ai-workflow-context/queue/ai-workflow-queue.service.ts`
  - 这些导入不是 boundary contract，而是 infrastructure 运行时常量。
  - ESLint 当前不拦截此路径（modules → infrastructure 常量不在 `no-infrastructure-to-modules-imports` 的反向检查范围内）。
- **影响**：
  - modules 层对 infrastructure 运行时细节的依赖缺乏边界契约隔离。
  - 若 BullMQ 队列名变更，modules 层需同步修改。
- **修复方案**（待评估）：
  1. 将队列名常量提升为 module-owned boundary contract 或 types 层的稳定契约（但需避免 types 层承载 framework 常量——见问题 10）。
  2. 或接受当前状态为已知的规则偏离，在 `bullmq.constants.ts` 中添加注释说明。
- **涉及文件**：
  - 上述 4 个 modules 文件
  - `src/infrastructure/bullmq/bullmq.constants.ts`
- **风险**：
  - 中等影响，需评估是否引入新的边界契约。

---

## 13. `src/modules/common/email-queue/email-queue.service.ts` 和 `email-worker/email-delivery.service.ts` 的 `maskEmail` 重复实现

- **状态**：[已解决] — maskEmail 已提取到 core/common/text/text.helper.ts，两个 service 改为导入
- **规范依据**：项目原则 — 避免同一逻辑的二次实现
- **现状**：
  - 两个文件各自实现了完全相同的 `private maskEmail(email: string): string` 方法（7 行）。
  - 逻辑：local part ≤2 字符时保留首字符 + `***`，否则保留前 2 字符 + `***`，域名原样保留。
  - 此问题已在 `question26-07-13.md` 中记录为问题 2，此处仅确认仍然存在。
- **影响**：重复实现，维护不同步风险。
- **修复方案**：见 `question26-07-13.md` 问题 2。
- **涉及文件**：
  - `src/modules/common/email-queue/email-queue.service.ts`
  - `src/modules/common/email-worker/email-delivery.service.ts`
- **风险**：低。

---

## 14. GraphQL Exception Filter 在生产环境将 401/403 映射为 INTERNAL_SERVER_ERROR 的潜在风险（B1 盲区已缓解）

- **状态**：[已缓解]
- **规范依据**：`docs/api/graphql-error-contract-current.md` — HTTP 401 → UNAUTHENTICATED, 403 → FORBIDDEN
- **现状**：
  - 经审查 `graphql-exception.filter.ts`，`mapHttpToGqlCode()` 函数正确地将 401 映射为 `UNAUTHENTICATED`、403 映射为 `FORBIDDEN`。
  - `buildGraphQLErrorFromHttpException()` 在生产环境保留大类错误码（UNAUTHENTICATED/FORBIDDEN 等），仅隐藏 errorCode/errorMessage 细节。
  - `buildGraphQLErrorFromUnknown()` 在生产环境将所有未知异常映射为 `INTERNAL_SERVER_ERROR`，但这是正确行为（未知异常不应泄露细节）。
  - 盲区报告 B1 中担心的"生产环境 401/403→INTERNAL_SERVER_ERROR"问题 **不存在**。
  - Filter spec 覆盖了 401→UNAUTHENTICATED、403→FORBIDDEN、400→BAD_USER_INPUT、500→INTERNAL_SERVER_ERROR 等主要分支，覆盖充分。
- **影响**：无。
- **修复方案**：无需修复。

---

## 15. `JwtAuthGuard.handleRequest` 忽略 `info` 参数（B1 盲区已缓解）

- **状态**：[已解决] — JwtAuthGuard 已检查 info 参数，将 TokenExpiredError/JsonWebTokenError/NotBeforeError 映射为精确的 DomainError
- **规范依据**：全局认证契约
- **现状**：
  - `JwtAuthGuard`（`src/adapters/api/graphql/guards/jwt-auth.guard.ts`）的 `handleRequest` 参数中 `_info` 被标记为 unused（第 48 行）。
  - 但当 `err || !user` 时，Guard 直接抛出 `DomainError(JWT_ERROR.AUTHENTICATION_FAILED)`，覆盖了 token 过期/签名错误场景。
  - `OptionalJwtAuthGuard` 正确检查了 `info` 参数，对 TokenExpiredError/JsonWebTokenError/NotBeforeError 抛出 `UnauthorizedException`。
  - 对于强制认证的 `JwtAuthGuard`，由于无 token 时 `user` 为 `false` 会直接抛错，`info` 被忽略不会导致无效 token 被当作匿名用户放行。
  - 但 `info` 中可能包含更精确的错误原因（如 token 过期 vs 签名无效），当前被统一为 `AUTHENTICATION_FAILED`，丢失了区分能力。
- **影响**：
  - 强制认证场景下不影响安全性（无效 token 不会被放行）。
  - 但客户端无法区分"token 过期"和"token 无效"，影响错误处理精确度。
- **修复方案**（待评估）：
  1. 在 `JwtAuthGuard.handleRequest` 中检查 `info` 参数，类似 `OptionalJwtAuthGuard` 的逻辑，将 TokenExpiredError/JsonWebTokenError 映射为更精确的 DomainError。
- **涉及文件**：
  - `src/adapters/api/graphql/guards/jwt-auth.guard.ts`
- **风险**：
  - 修改后需确认 Filter 对新抛出的错误码有正确映射。

---

## 16. ESLint 检查发现的 Prettier 格式问题

- **状态**：[已解决] — lint --fix 已运行，当前 ESLint 0 errors
- **规范依据**：代码质量
- **现状**：
  - ESLint 运行发现 23 个 error，其中大部分为 Prettier 格式问题（prettier/prettier）。
  - 涉及文件包括：
    - `src/infrastructure/graphql/filters/graphql-exception.filter.spec.ts`（7 个格式问题）
    - `src/modules/account/base/services/account.service.ts`（2 个格式问题）
    - `src/modules/reference/reference-capability.module.ts`（2 个格式问题）
    - `src/modules/verification-record/queries/verification-read.query.service.ts`（2 个格式问题）
    - `src/modules/verification-record/queries/verification-record.query.service.ts`（1 个 unused var）
    - `src/usecases/auth/login-with-user-info.usecase.ts`（1 个跨域依赖 + 1 个格式问题）
    - `src/usecases/verification-record/create-verification-record.usecase.ts`（1 个格式问题）
- **影响**：代码风格不一致。
- **修复方案**：
  1. 运行 `npm run lint`（含 `--fix`）自动修复格式问题。
  2. 手动处理 `no-unused-vars` 和跨域依赖问题。
- **涉及文件**：上述文件列表
- **风险**：低。

---

## 17. `src/infrastructure/third-party-auth/providers/weapp-http.provider.ts` 硬编码 URL 和 timeout（B8 盲区部分缓解）

- **状态**：[部分缓解]
- **规范依据**：项目非协商规则 — "Do not hardcode configuration, secrets, URLs, tokens, or credentials. Use configuration modules."
- **现状**：
  - `weapp-http.provider.ts` 的 URL `https://api.weixin.qq.com` 和 timeout `10000` 作为 **默认值** 通过 options 参数注入（`options.apiBaseUrl ?? 'https://api.weixin.qq.com'`，`options.requestTimeout ?? 10000`），支持通过 DI 配置覆盖。
  - `cravatar-avatar-generator.adapter.ts` 的 URL `https://cravatar.cn/avatar` 同样使用 `process.env.CRAVATAR_BASE_URL ?? 'https://cravatar.cn/avatar'` 模式。
  - `gravatar-avatar-generator.adapter.ts` 使用 `process.env.GRAVATAR_BASE_URL ?? 'https://www.gravatar.com/avatar'`。
- **影响**：
  - URL 和 timeout 有默认值但可通过配置覆盖，属于半硬编码状态。
  - `process.env` 直接读取在 infrastructure 层是允许的，但 `weapp-http.provider.ts` 通过 options token 注入更规范。
  - cravatar/gravatar 的 `process.env` 直接读取在 infrastructure 层合规，但应优先通过 ConfigService/options token。
- **修复方案**（待评估）：
  1. cravatar/gravatar adapter 也应使用 options token 注入，而非直接读 `process.env`。
  2. 或接受当前状态为 infrastructure 层的已知偏离。
- **涉及文件**：
  - `src/infrastructure/blog-storage/cravatar-avatar-generator.adapter.ts`
  - `src/infrastructure/blog-storage/gravatar-avatar-generator.adapter.ts`
- **风险**：低。

---

## 18. `src/modules/third-party-auth/providers/wechat.provider.ts` 在 modules 层使用 `HttpException`（B7 盲区）

- **状态**：[已解决] — modules 层 wechat.provider.ts 已删除（未被 DI 注册的死代码），infrastructure 层 WechatAuthProvider 的 HttpException 已替换为 DomainError
- **规范依据**：`docs/common/modules.rules.md` — modules 层应通过 DI 承接 infrastructure 实现，不应直接使用 HTTP 协议异常
- **现状**：
  - `wechat.provider.ts` 导入了 `HttpException` 和 `HttpStatus`，在 modules 层直接抛出 HTTP 协议异常。
  - 这属于 modules 层混入 adapter/协议细节。
  - 该文件标注为 TODO（"实现完整的网页/公众号 OAuth 认证流程"），可能是未完成的实现。
- **影响**：
  - modules 层不应感知 HTTP 协议语义，应使用 `DomainError` 代替 `HttpException`。
  - 当前文件可能为死代码（TODO 状态），影响有限。
- **修复方案**（待评估）：
  1. 将 `HttpException` 替换为 `DomainError`。
  2. 或在完成 TODO 实现时确保不使用协议层异常。
- **涉及文件**：
  - `src/modules/third-party-auth/providers/wechat.provider.ts`
- **风险**：低（TODO 状态文件）。
