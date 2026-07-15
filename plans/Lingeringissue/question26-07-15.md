# 遗留问题清单 - 2026-07-15

> 本文件记录全局架构深度 review（含方法体语义审计）过程中发现但未能直接修复的问题。
> 标记说明：[未解决] / [已解决]
> 审计方法：import 级依赖方向 + 方法体语义级深审（覆盖 B1-B9 盲区）

---

## 1. GraphQL 认证守卫忽略 Passport `info` 参数，无效 token 可能被放行

- **状态**：[已解决]
- **严重度**：高
- **规范依据**：全局认证契约 — 携带无效 token（过期/签名错误）时应抛出认证错误，而非放行为匿名用户
- **现状**：
  - `src/adapters/api/graphql/guards/optional-jwt-auth.guard.ts` 的 `handleRequest<TUser>(err, user)` 只检查 `err`，忽略 Passport 通过第三个参数 `info` 传入的 token 过期/签名错误信息。
  - 当 `err` 为 null 但 `info` 有值（如 `TokenExpiredError`、`JsonWebTokenError`）时，用户被当作匿名放行，违反"携带无效 token → 抛认证错误"的契约。
- **影响**：
  - 攻击者/用户携带过期/伪造 token 访问可选认证接口时，不会被拒绝，而是以匿名身份执行操作。
  - 对于需要区分"已登录/未登录/登录失败"三种状态的场景，当前实现丢失了"登录失败"状态。
- **修复方案**：
  1. 修改 `handleRequest` 签名为 `handleRequest<TUser>(err, user, info)`，增加 `info` 参数处理。
  2. 当 `info` 存在且表示认证失败（如 `info instanceof Error` 或 `info?.name === 'TokenExpiredError'`）时，抛出认证错误。
  3. 仅当 `err` 为 null 且 `info` 为 null/undefined/false 时，才放行为匿名。
- **涉及文件**：
  - `src/adapters/api/graphql/guards/optional-jwt-auth.guard.ts`
- **风险**：
  - 修改后需确认所有使用 `OptionalJwtAuthGuard` 的接口行为符合预期。
  - 需补充单测覆盖 `info` 参数的各种情况。

---

## 2. GraphQL 全局异常过滤器在生产环境将所有 HttpException 强制映射为 INTERNAL_SERVER_ERROR

- **状态**：[已解决]
- **严重度**：高
- **规范依据**：全局错误分类契约 — 会话失效→UNAUTHENTICATED, 权限失败→FORBIDDEN, 输入失败→BAD_USER_INPUT，不能伪装成内部错误
- **现状**：
  - `src/infrastructure/graphql/filters/graphql-exception.filter.ts` 的 `buildGraphQLErrorFromHttpException` 中，`extensions.code` 在 `isProdEnv` 时硬编码为 `'INTERNAL_SERVER_ERROR'`，覆盖了 `mapHttpToGqlCode(status)` 的正确映射。
  - 导致生产环境中 401/403/400/404/409 等 HttpException 的 `extensions.code` 全部变成 `INTERNAL_SERVER_ERROR`。
  - 现有单测只覆盖了 `DomainError(CAPABILITY_UNAVAILABLE)`，未覆盖 HttpException 的 401/403/400 分支。
- **影响**：
  - 前端无法根据 `extensions.code` 区分认证失败、权限不足、输入错误，全部显示"服务器内部错误"。
  - 违反全局错误契约，可能导致前端登录态判断失效。
- **修复方案**：
  1. 修改 `buildGraphQLErrorFromHttpException`，在生产环境仍使用 `code ?? mapHttpToGqlCode(status)` 作为 `extensions.code`。
  2. 生产环境仅隐藏 `errorMessage` 和 `errorCode` 的细节，但保留大类错误码（UNAUTHENTICATED/FORBIDDEN/BAD_USER_INPUT）。
  3. 补充单测覆盖 401→UNAUTHENTICATED、403→FORBIDDEN、400→BAD_USER_INPUT 在生产环境的行为。
- **涉及文件**：
  - `src/infrastructure/graphql/filters/graphql-exception.filter.ts`
  - 对应 `*.spec.ts`
- **风险**：
  - 修改后需确认前端对 `extensions.code` 的消费逻辑是否依赖当前的 INTERNAL_SERVER_ERROR 行为。

---

## 3. Usecase 暂存和操作 ORM Entity — Account 域

- **状态**：[已解决]
- **严重度**：高
- **规范依据**：`docs/common/entity.rules.md` — Usecase 不得 import 或短暂持有 ORM Entity；Modules 对上游必须返回 View/snapshot/稳定 data shape
- **现状**：
  - `src/modules/account/base/services/account.service.ts` 对外暴露 `createAccountEntity(): AccountEntity`、`saveAccount(): Promise<AccountEntity>`、`createUserInfoEntity(): UserInfoEntity`、`saveUserInfo(): Promise<UserInfoEntity>` 等 Entity 接口。
  - `src/usecases/account/create-account.usecase.ts` 持有 `savedAccount` 并读取 `savedAccount.id`、`savedAccount.createdAt`。
  - `src/usecases/auth/login-with-password.usecase.ts` 读取 `account.id`、`account.status`、`account.createdAt`。
  - `src/usecases/auth/execute-login-flow.usecase.ts` 读取 `loginSnapshot.account.id`、`loginSnapshot.account.status`。
  - `src/usecases/registration/register-with-email.usecase.ts` 读取 `savedAccount.id`、`savedAccount.createdAt`、`account.id`、`account.status`。
  - `src/usecases/registration/weapp-register.usecase.ts` 同样读取 Entity 字段。
- **影响**：
  - Usecase 与 ORM Entity 耦合，Entity 字段变更会导致 Usecase 编译失败或行为异常。
  - 违反分层规则：Usecase 不应感知 ORM 持久化细节。
- **修复方案**：
  1. AccountService 新增 `createAccount(params): Promise<AccountSnapshot>` 方法，返回稳定 snapshot（包含 id、createdAt 等必要字段）。
  2. 废弃 `createAccountEntity()`、`saveAccount()` 等 Entity 暴露方法，或改为 private。
  3. Usecase 改为调用返回 snapshot 的方法，不再持有 Entity。
  4. 同理处理 UserInfo 相关方法。
- **涉及文件**：
  - `src/modules/account/base/services/account.service.ts`
  - `src/usecases/account/create-account.usecase.ts`
  - `src/usecases/auth/login-with-password.usecase.ts`
  - `src/usecases/auth/execute-login-flow.usecase.ts`
  - `src/usecases/registration/register-with-email.usecase.ts`
  - `src/usecases/registration/weapp-register.usecase.ts`
  - `src/usecases/verification/password/reset-password.usecase.ts`
- **风险**：
  - 涉及多个 Usecase 的核心流程，需逐一验证修改后的行为一致性。
  - 需确保 snapshot 包含所有 Usecase 需要的字段。

---

## 4. Usecase 暂存和操作 ORM Entity — Verification 域

- **状态**：[已解决]
- **严重度**：高
- **规范依据**：同问题 3
- **现状**：
  - `src/modules/verification-record/verification-record.service.ts` 的 `createRecord()` 返回 `Promise<VerificationRecordEntity>`，`consumeRecord()` 返回 `Promise<VerificationRecordEntity>`。
  - `src/usecases/verification-record/create-verification-record.usecase.ts` 调用 `this.verificationRecordQueryService.toDetailView(record)` 将 Entity 传给 QueryService mapper。
  - `src/usecases/verification-record/consume-verification-record.usecase.ts` 同样调用 `toDetailView(updatedRecord)` / `toCleanView(updatedRecord)`。
  - `src/modules/verification-record/queries/verification-record.query.service.ts` 的 `toDetailView(record: VerificationRecordEntity)` 和 `toCleanView(record: VerificationRecordEntity)` 以 Entity 作为映射参数契约。
- **影响**：
  - QueryService 对外以 Entity 作为映射参数契约，违反 QueryService 只读语义和 Entity 不暴露规则。
  - Usecase 通过 QueryService 间接持有 Entity。
- **修复方案**：
  1. VerificationRecordService 的 `createRecord()` / `consumeRecord()` 返回稳定 snapshot 或 View。
  2. QueryService 的 `toDetailView()` / `toCleanView()` 改为接受 snapshot/View 参数，或改为 private 方法。
  3. Usecase 不再直接操作 Entity。
- **涉及文件**：
  - `src/modules/verification-record/verification-record.service.ts`
  - `src/modules/verification-record/queries/verification-record.query.service.ts`
  - `src/usecases/verification-record/create-verification-record.usecase.ts`
  - `src/usecases/verification-record/consume-verification-record.usecase.ts`
- **风险**：
  - Verification 域消费流程较复杂，需确保 snapshot 包含所有必要字段。

---

## 5. Usecase 暂存和操作 ORM Entity — AI Workflow 域

- **状态**：[已解决] — 经审查确认该域服务已返回 View 类型，不存在 Entity 泄漏
- **严重度**：高
- **规范依据**：同问题 3
- **现状**：
  - `src/modules/ai-workflow-context/ai-workflow-context.service.ts` 多个方法返回 `Promise<AiWorkflowContextEntity>` 或 `Promise<AiWorkflowContextEntity | null>`。
  - Usecase 通过这些方法持有 Entity 并读取字段。
- **影响**：同问题 3。
- **修复方案**：同问题 3，改为返回 snapshot/View。
- **涉及文件**：
  - `src/modules/ai-workflow-context/ai-workflow-context.service.ts`
  - 相关 Usecase
- **风险**：同问题 3。

---

## 6. Adapter 内业务编排 — Auth/ThirdPartyAuth Resolver 编排多 Usecase

- **状态**：[已解决]
- **严重度**：高
- **规范依据**：`docs/api/adapters.rules.md` — Adapter 只负责注入身份和映射结果；多 Usecase 编排必须归 Usecase
- **现状**：
  - `src/adapters/api/graphql/auth/auth.resolver.ts:35` — `login()` 先调用 `loginWithPasswordUsecase.execute()`，再调用 `fetchUserInfoUsecase.executeForLoginFlow()`，Resolver 编排了两个 Usecase。
  - `src/adapters/api/graphql/third-party-auth/third-party-auth.resolver.ts:67` — `thirdPartyLogin()` 同样编排 login + fetchUserInfo。
- **影响**：
  - Adapter 层承担了业务编排职责，违反分层规则。
  - 登录流程的变更需要修改 Resolver，而非 Usecase。
- **修复方案**：
  1. 新增 `LoginWithUserInfoUsecase`（或修改现有 `LoginWithPasswordUsecase`），在 Usecase 内编排 login + fetchUserInfo。
  2. Resolver 只调用单一 Usecase，仅做 DTO 映射。
  3. 同理处理 ThirdPartyAuth Resolver。
- **涉及文件**：
  - `src/adapters/api/graphql/auth/auth.resolver.ts`
  - `src/adapters/api/graphql/third-party-auth/third-party-auth.resolver.ts`
  - 新增或修改对应 Usecase
- **风险**：
  - 需确保登录流程中 fetchUserInfo 的安全验证逻辑不丢失。

---

## 7. Adapter 内授权决策 — VerificationRecord Resolver 内做角色和 token 返回判断

- **状态**：[已解决]
- **严重度**：高
- **规范依据**：`docs/api/adapters.rules.md` — Adapter 不应做流程级授权和敏感输出策略决策
- **现状**：
  - `src/adapters/api/graphql/verification-record/verification-record.resolver.ts:68` — `createVerificationRecord()` 内做 `normalizedUserRoles.includes(ADMIN)` + `result.generatedByServer === true` 判断，决定是否返回明文 token。
  - 这是流程级授权和敏感输出策略，应由 Usecase 决定。
- **影响**：
  - 授权逻辑分散在 Adapter 层，难以测试和维护。
  - 修改授权策略需要改 Resolver，而非 Usecase。
- **修复方案**：
  1. 将角色判断和 token 返回决策移入 `CreateVerificationRecordUsecase`。
  2. Usecase 接收 session/user 信息，内部决定是否返回 token。
  3. Resolver 仅做 DTO 映射，不再做条件判断。
- **涉及文件**：
  - `src/adapters/api/graphql/verification-record/verification-record.resolver.ts`
  - `src/usecases/verification-record/create-verification-record.usecase.ts`
- **风险**：
  - 需确保 Usecase 能获取到当前用户角色信息。

---

## 8. Resolver 吞掉 DomainError，绕过全局错误契约

- **状态**：[已解决]
- **严重度**：中高
- **规范依据**：全局 GraphQL 错误分类契约 — DomainError 应冒泡到全局 Filter，Adapter 不应吞掉
- **现状**：
  - `src/adapters/api/graphql/account/account.resolver.ts:79` — `resetPassword()` catch 后返回 `{ success: false, message: ... }`。
  - `src/adapters/api/graphql/verification-record/verification-record.resolver.ts:101` — `createVerificationRecord()` catch 后返回 `{ success: false, ... }`。
  - `src/adapters/api/graphql/verification-record/verification-record.resolver.ts:183` — `consumeVerificationRecord()` 同样 catch 吞 DomainError。
  - `src/adapters/api/graphql/verification-record/verification-record.resolver.ts:227` — `revokeVerificationRecord()` 同样 catch 吞 DomainError。
- **影响**：
  - DomainError.code 不再进入 `errors[].extensions`，前端无法根据错误码做精确处理。
  - `error.message` 直接暴露给客户端，可能泄露内部错误信息。
  - 全局错误过滤器的错误分类逻辑被绕过。
- **修复方案**：
  1. 移除 Resolver 内的 try-catch，让 DomainError 冒泡到全局 GraphQL Filter。
  2. 如果需要结构化响应（如 `{ success, message }`），在 Usecase 内部处理，或使用专门的 Error 类型。
  3. 确保 `error.message` 不直接暴露给客户端（生产环境由 Filter 统一处理）。
- **涉及文件**：
  - `src/adapters/api/graphql/account/account.resolver.ts`
  - `src/adapters/api/graphql/verification-record/verification-record.resolver.ts`
- **风险**：
  - 前端可能依赖当前的 `{ success, message }` 响应格式，需协调前端修改。
  - 需确保全局 Filter 能正确处理所有 DomainError 子类。

---

## 9. 通用 Capability dispatcher/bus 抽象仍保留

- **状态**：[部分解决] — CapabilityModule 仍在 worker.module.ts 中使用，需创建治理计划决定保留/移除
- **严重度**：中高
- **规范依据**：`docs/common/capability.rules.md` — 不建立通用 bus、dispatcher、envelope，不用它包装普通调用
- **现状**：
  - `src/usecases/common/ports/capability-bus.contract.ts` 保留完整的通用 Command/Query/Event Bus、Permission Checker、Queue Transport 抽象。
  - `src/infrastructure/bullmq/queue-registry.ts` 仍注册 `CAPABILITY` 队列。
  - `src/types/worker/bullmq.types.ts` 的 `BULLMQ_QUEUES.CAPABILITY` 和 `BULLMQ_JOBS.CAPABILITY.DISPATCH` 仍存在。
- **影响**：
  - 与当前 Capability 规则冲突。
  - `plans/README.md` 无对应治理计划。
- **修复方案**：
  1. 确认 Capability Bus 是否仍被使用。如无使用方，标记为废弃或移除。
  2. 从 `queue-registry.ts` 移除 `CAPABILITY` 队列注册。
  3. 从 `bullmq.types.ts` 移除 `CAPABILITY` 相关常量。
  4. 如需保留，在 `plans/` 中创建治理计划。
- **涉及文件**：
  - `src/usecases/common/ports/capability-bus.contract.ts`
  - `src/infrastructure/bullmq/queue-registry.ts`
  - `src/types/worker/bullmq.types.ts`
  - `src/infrastructure/bullmq/bullmq.module.ts`
- **风险**：
  - 需确认无运行时依赖 Capability 队列的 job。

---

## 10. reference.report Capability Anchor 与决策冲突

- **状态**：[已解决]
- **严重度**：中
- **规范依据**：稳定 reference 决策明确说 report 只是 composition usecase、没有 Capability ID
- **现状**：
  - `src/modules/reference/reference-report.capability.ts` 声明 `reference.report` Anchor，但该部分当前未进入默认 API/Worker 图，属于静态遗留违规。
- **影响**：
  - Capability ID 定义与决策不一致，可能在 Capability registry 中产生无效注册。
- **修复方案**：
  1. 移除 `reference-report.capability.ts`，或将 report 逻辑改为 composition usecase（不声明 Capability Anchor）。
  2. 如需保留 Capability，更新决策文档。
- **涉及文件**：
  - `src/modules/reference/reference-report.capability.ts`
  - `docs/capabilities/current.md`
- **风险**：低。

---

## 11. types 层包含运行时副作用

- **状态**：[已解决]
- **严重度**：中
- **规范依据**：`docs/common/type.rules.md` — types 层应只有稳定、无框架的契约和 enum
- **现状**：
  - `src/types/common/field-encryption.metadata.ts` 包含 `import 'reflect-metadata'` + `Reflect.getMetadata/defineMetadata`，与 infrastructure 中的实现重复，且违反 types 层无运行时副作用规则。
- **影响**：
  - types 层引入了运行时副作用，增加了模块加载时的副作用风险。
  - 与 infrastructure 层的 `registerEncryptedField` 实现重复。
- **修复方案**：
  1. 将 `registerEncryptedField` 的实现保留在 infrastructure 层，types 层只声明 metadata key 常量和接口。
  2. 或者将 `reflect-metadata` 的 import 移到 infrastructure 层的 registrar 中。
- **涉及文件**：
  - `src/types/common/field-encryption.metadata.ts`
  - `src/infrastructure/database/encryption/account-field-encryption.registrar.ts`
- **风险**：需确认 `reflect-metadata` 的 polyfill 加载时机。

---

## 12. types 层包含 framework-specific 和单流程类型

- **状态**：[部分解决] — 需治理计划协调 import 路径变更和循环依赖风险
- **严重度**：中
- **规范依据**：`docs/common/type.rules.md` — types 应为稳定无框架契约；单流程类型应 collocate
- **现状**：
  - `src/types/response.types.ts` 是 Ant Design Pro 风格的 `ApiResponse`，仅被 infrastructure middleware 使用，不应进入全局共享类型层。
  - `src/types/models/registration.types.ts` 仅服务单个注册流程，应 collocate 到相邻 Usecase。
  - `src/types/worker/bullmq.types.ts` 承载 BullMQ 队列名常量（`BULLMQ_QUEUES`、`BULLMQ_JOBS`），与"infrastructure registry 是 runtime 真源"的文档要求相反。
- **影响**：
  - 全局 types 层被 framework-specific 和单流程类型污染，降低可维护性。
  - BullMQ 常量在 types 层定义，infrastructure 层失去真源控制权。
- **修复方案**：
  1. `response.types.ts` 移到 `src/infrastructure/` 下对应 middleware 旁。
  2. `registration.types.ts` 积到 `src/usecases/registration/` 下。
  3. `bullmq.types.ts` 的队列名常量移回 `src/infrastructure/bullmq/bullmq.constants.ts`，其他层通过 boundary contract 引用。
- **涉及文件**：
  - `src/types/response.types.ts`
  - `src/types/models/registration.types.ts`
  - `src/types/worker/bullmq.types.ts`
  - 所有引用这些文件的地方
- **风险**：
  - 文件迁移涉及多处 import 路径变更，需配合 ESLint 验证。
  - BullMQ 常量迁移可能引入循环依赖，需仔细设计 boundary contract。

---

## 13. modules 层死代码 — WeAppProvider 直接使用 HttpService

- **状态**：[已解决]
- **严重度**：中
- **规范依据**：modules 层不应直接调用第三方接口（属于 infrastructure 职责）
- **现状**：
  - `src/modules/third-party-auth/providers/weapp.provider.ts` 在 modules 层直接使用 `HttpService` 调微信接口。
  - 已有 `src/infrastructure/third-party-auth/providers/weapp-http.provider.ts` 作为替代实现。
  - 该文件属于死代码遗留。
- **影响**：
  - modules 层存在 infrastructure 职责的代码，违反分层规则。
  - 死代码增加维护负担。
- **修复方案**：
  1. 确认 `WeAppProvider`（modules 层）无任何注入/使用方。
  2. 移除 `weapp.provider.ts` 及相关文件。
- **涉及文件**：
  - `src/modules/third-party-auth/providers/weapp.provider.ts`
- **风险**：需确认无 DI 注册引用。

---

## 14. 同域 ThirdPartyProvider 接口重复定义

- **状态**：[已解决]
- **严重度**：中
- **规范依据**：单一真源原则 + `*.contract.ts` 边界命名规范
- **现状**：
  - `src/modules/third-party-auth/interfaces/third-party-provider.interface.ts` 定义 `ThirdPartyProvider` 接口。
  - `src/modules/third-party-auth/contracts/third-party-provider.contract.ts` 定义同名 `ThirdPartyProvider` 接口（扩展了更多方法）。
  - 两个文件违反单一真源和 `*.contract.ts` 边界命名规范。
- **影响**：
  - 同域两个同名接口造成混淆，consumer 可能引用错误的定义。
- **修复方案**：
  1. 保留 `contracts/third-party-provider.contract.ts` 作为唯一真源。
  2. 移除 `interfaces/third-party-provider.interface.ts`。
  3. 所有引用方改为从 `contracts/` 导入。
- **涉及文件**：
  - `src/modules/third-party-auth/interfaces/third-party-provider.interface.ts`
  - `src/modules/third-party-auth/contracts/third-party-provider.contract.ts`
  - 所有引用方
- **风险**：需确认 `interfaces/` 版本的使用方。

---

## 15. infrastructure 层硬编码第三方 API URL 和 timeout

- **状态**：[已解决]
- **严重度**：中
- **规范依据**：项目非协商规则 — 外部服务 URL 和 timeout 应通过 ConfigService/options token 注入
- **现状**：
  - `src/infrastructure/third-party-auth/providers/weapp-http.provider.ts` 硬编码 4 个微信 API URL 和 4 处 `timeout: 10000`。
  - `src/infrastructure/blog-storage/cravatar-avatar-generator.adapter.ts` 硬编码 `'https://cravatar.cn/avatar/'`。
  - `src/infrastructure/blog-storage/gravatar-avatar-generator.adapter.ts` 硬编码 `'https://www.gravatar.com/avatar/'`。
- **影响**：
  - URL 和 timeout 变更需要修改代码并重新部署，无法通过配置热更新。
  - 不同环境（开发/测试/生产）可能需要不同的 URL 和 timeout。
- **修复方案**：
  1. 微信 API URL 和 timeout 通过 WeAppProviderOptions token 注入（当前已有 `WEAPP_PROVIDER_OPTIONS`，需扩展）。
  2. Cravatar/Gravatar URL 通过 ConfigService 或 options token 注入。
- **涉及文件**：
  - `src/infrastructure/third-party-auth/providers/weapp-http.provider.ts`
  - `src/infrastructure/blog-storage/cravatar-avatar-generator.adapter.ts`
  - `src/infrastructure/blog-storage/gravatar-avatar-generator.adapter.ts`
- **风险**：低。

---

## 16. GraphQL exception filter 单测未覆盖 HttpException 生产环境分支

- **状态**：[部分解决] — 需单独编写单测，补充 401/403/400 生产环境映射测试
- **严重度**：中
- **规范依据**：关键路径应有单测覆盖
- **现状**：
  - `src/infrastructure/graphql/filters/*.spec.ts` 只覆盖了 `DomainError(CAPABILITY_UNAVAILABLE)`，未覆盖 HttpException 401/403/400 在生产环境被映射为 INTERNAL_SERVER_ERROR 的分支。
- **影响**：
  - 问题 2 的违规未被单测发现，生产环境行为无验证。
- **修复方案**：
  1. 补充 HttpException 401/403/400/404/409 在生产环境的单测。
  2. 验证 `extensions.code` 在生产环境是否正确映射（修复问题 2 后）。
- **涉及文件**：
  - `src/infrastructure/graphql/filters/graphql-exception.filter.spec.ts`
- **风险**：低。

---

## 本次 review 已识别但已解决项（供对照）

> 以下问题在 2026-07-15 的 review 中确认已由先前 review 解决，此处仅作记录。

### 17. modules 层对 infrastructure 的运行时依赖（2026-07-09 已解决）

- **状态**：[已解决]
- **修复**：详见 `question26-07-09.md` 第 2 项。

### 18. capability ID 字符串字面量重复（2026-07-13 已解决）

- **状态**：[已解决]
- **修复**：详见 `question26-07-13.md` 第 3 项。

### 19. maskEmail 重复实现（2026-07-13 已记录）

- **状态**：[未解决]
- **备注**：详见 `question26-07-13.md` 第 2 项，本次 review 不重复记录。
