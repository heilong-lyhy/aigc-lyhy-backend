# 遗留问题清单 - 2026-07-16

> 本文件记录全局架构检查（`plans/check/global-architecture-check.md`）第二轮及第三轮 review 中仍存在的问题及新发现问题。
> 标记说明：[未解决] / [已解决] / [已缓解]
> 审计方法：import 级依赖方向 + 方法体语义级深审（覆盖 B1-B9 盲区）+ 同功能二次实现扫描 + docs 规范偏离检查

---

## 已修复确认（07-15 → 07-16）

以下问题在上一轮（07-15）报告中标记为未解决，经本轮检查确认已修复或缓解：

| # | 问题 | 状态 |
|---|------|------|
| 原 #1 | 跨域 Usecase 依赖 `login-with-user-info.usecase.ts` | [已解决] — 已改为 DI 注入 AccountQueryService/AccountSecurityService，不再跨域依赖 FetchUserInfoUsecase |
| 原 #2 | Service 对上游返回 Entity 类型 | [已解决] — account.service.ts 公开方法改为返回 Snapshot，ai-workflow-context/ai-provider-call-record Entity 方法改为 private |
| 原 #3 | QueryService mapper 参数接受 Entity 类型 | [已解决] — verification-read.query.service.ts 的 toCleanView/toDetailView 已改为仅接受 Snapshot |
| 原 #4 | Resolver catch 吞非 DomainError 异常 | [已解决] — findVerificationRecord 的 try-catch 已移除，DomainError 自然冒泡到全局 Filter |
| 原 #5 | capability-bus.contract.ts 保留通用 Bus 抽象 | [部分解决] — CommandBus/QueueTransport/QueueConsumer/EventPublisher/PermissionChecker 已移除，CAPABILITY 队列已移除，仅保留 QueryBus |
| 原 #6 | notification.email Capability ID 未在决策文档声明 | [已解决] — 已在 `docs/capabilities/current.md` 中声明 |
| 原 #7 | ai.provider-call-observation Capability ID 未在决策文档声明 | [已解决] — 已在 `docs/capabilities/current.md` 中声明 |
| 原 #8 | types 层从 infrastructure re-export | [已解决] — transaction.types.ts 已移除 re-export |
| 原 #9 | response.types.ts 仅被 infrastructure 使用 | [已解决] — 文件已移除 |
| 原 #10 | bullmq.types.ts 承载 BullMQ 常量 | [已解决] — 文件已移除 |
| 原 #11 | registration.types.ts 仅服务单流程 | [已解决] — 文件已移除 |
| 原 #13 | WeAppProvider 死代码 | [已解决] — 文件已移除 |
| 原 #14 | ThirdPartyProvider 接口重复定义 | [已解决] — interfaces/ 目录已移除 |

---

## 1. Service 对上游返回 Entity 类型（B2 盲区）

- **状态**：[已解决] — `createAccountEntity`/`createUserInfoEntity` 已改为 private；其他 Entity 返回方法此前已为 private；公开方法均返回 Snapshot

---

## 2. Resolver 吞掉异常返回 null（B4 盲区）

- **状态**：[已解决] — findVerificationRecord 的 try-catch 已移除，DomainError 自然冒泡到全局 Filter
- **严重度**：中高
- **规范依据**：全局 GraphQL 错误分类契约 — DomainError 应冒泡到全局 Filter，Adapter 不应吞掉
- **现状**：
  - `src/adapters/api/graphql/verification-record/verification-record.resolver.ts` 第 136 行：
    ```typescript
    } catch {
      return null;
    }
    ```
  - `findVerificationRecord()` 方法的 try-catch 将所有异常（包括 DomainError）吞掉后返回 `null`，绕过了全局 GraphQL 错误过滤器。
  - 当验证记录查询因业务异常失败时，客户端收不到任何错误信息，仅得到 `null`，无法区分"记录不存在"和"查询出错"。
- **影响**：
  - DomainError 不再进入全局 Filter 的错误分类逻辑，前端无法通过 `errors[].extensions.code` 做精确处理。
  - 业务异常被静默吞掉，增加排障难度。
- **修复方案**：
  1. 移除 try-catch，让 DomainError 自然冒泡到全局 Filter。
  2. 对于"记录不存在"的正常情况，Usecase 应返回 `null`（非异常路径），而非通过 catch 返回。
  3. 确保异常路径和正常空值路径有清晰区分。
- **涉及文件**：
  - `src/adapters/api/graphql/verification-record/verification-record.resolver.ts`
- **风险**：前端可能依赖当前 `null` 返回行为，需确认变更后的兼容性。

---

## 3. 通用 Capability Bus 抽象仍保留（B5 盲区）

- **状态**：[部分解决] — CapabilityCommandBus/QueueTransport/QueueConsumer/EventPublisher/PermissionChecker 已移除，仅保留 CapabilityQueryBus（因 DispatcherReferenceProfileClient 消费方）
- **严重度**：中高
- **规范依据**：`docs/common/capability.rules.md` — "Do not add a generic capabilities layer or runtime bus that wraps ordinary calls"；"Cross-capability business calls use an existing owner-facing surface or a narrow typed contract; no generic dispatcher or envelope is required"
- **现状**：
  - `src/usecases/common/ports/capability-bus.contract.ts` 定义了完整的通用 Bus 抽象：
    - `CapabilityCommandBus`（execute 方法）
    - `CapabilityQueryBus`（ask 方法）
    - `CapabilityQueueTransport` / `CapabilityQueueConsumer`
    - `CapabilityEventPublisher` / `CapabilityEventSubscriber`
    - `CapabilityPermissionChecker`
    - 大量泛型 envelope 类型
  - 唯一消费方：`src/infrastructure/capability/reference-profile.client.ts` 的 `DispatcherReferenceProfileClient`，通过 `CAPABILITY_QUERY_BUS` 调用 `ask` 方法。
  - CAPABILITY 队列已从 `queue-registry.ts` 和 `bullmq.types.ts` 中移除，但 Bus 抽象和实现仍在。
  - `src/infrastructure/capability/reference-profile-client.module.ts` 注册了 `DispatcherReferenceProfileClient`。
- **影响**：
  - 通用 Bus 抽象与 Capability 规则明确禁止的"generic dispatcher or envelope"一致，存在被滥用的风险。
  - 若未来有新的跨 capability 调用需求，开发者可能直接使用 Bus 而非遵循"窄类型 contract"规则。
- **修复方案**：
  1. 将 `DispatcherReferenceProfileClient` 改为直接调用 reference-profile handler（窄类型），移除对 `CapabilityQueryBus` 的依赖。
  2. 废弃并移除 `capability-bus.contract.ts` 中的通用 Bus 抽象。
  3. 移除 `reference-profile-client.module.ts` 中的 Bus 注入。
- **涉及文件**：
  - `src/usecases/common/ports/capability-bus.contract.ts`
  - `src/infrastructure/capability/reference-profile.client.ts`
  - `src/infrastructure/capability/reference-profile-client.module.ts`
- **风险**：需确保 `ReferenceProfileClient` 有其他可用的窄类型实现路径。

---

## 4. `notification.email` Capability 缺少 Anchor（B5 盲区）

- **状态**：[已解决] — 已在 `email-capability.providers.ts` 中新增 `NotificationEmailCapabilityAnchor`（mode: switchable），并在 `EmailCapabilityModule` 中注册

---

## 5. `ai.provider-call-observation` Capability ID 未在决策文档声明（B5 盲区）

- **状态**：[已解决] — 已在 `docs/capabilities/current.md` 中声明 ai.provider-call-observation
- **严重度**：中
- **规范依据**：`docs/common/capability.rules.md` — Capability admission 需要决策文档
- **现状**：
  - `src/modules/ai-provider-call-record/ai-provider-call-observation.capability.ts` 定义了 `AI_PROVIDER_CALL_OBSERVATION_CAPABILITY_ID = 'ai.provider-call-observation'`。
  - `docs/capabilities/current.md` 中仅有 `ai.execution` 和 `ai.workflow`，无 `ai.provider-call-observation`。
  - 该 Anchor 声明为 `always-on`，requires 为空。
- **影响**：
  - Capability ID 未经治理决策，存在漂移风险。
  - 与 `ai.execution` 的关系不明确——按决策文档，"provider-call observation"可能属于 `ai.execution` 的职责范围。
- **修复方案**：
  1. 在 `docs/capabilities/current.md` 中补充 `ai.provider-call-observation` 的决策。
  2. 或将其合并到 `ai.execution` 下，移除独立 Anchor，将 call-record 观察能力归入 `ai.execution` 的 RuntimeContribution。
- **涉及文件**：
  - `src/modules/ai-provider-call-record/ai-provider-call-observation.capability.ts`
  - `docs/capabilities/current.md`
- **风险**：影响范围较小，该 capability 为 always-on 且无 switchable gate。

---

## 6. `maskEmail` 同功能私有方法重复实现（第三步 — 同功能二次实现）

- **状态**：[已解决] — maskEmail 已提取到 core/common/text/text.helper.ts，两个 service 改为导入
- **严重度**：低
- **规范依据**：单一真源原则；通用逻辑应抽取到共享位置
- **现状**：
  - `src/modules/common/email-worker/email-delivery.service.ts` 第 128 行：`private maskEmail(email: string): string`
  - `src/modules/common/email-queue/email-queue.service.ts` 第 62 行：`private maskEmail(email: string): string`
  - 两个实现完全相同：
    ```typescript
    private maskEmail(email: string): string {
      const parts = email.split('@');
      if (parts.length !== 2) return '***';
      const [localPart, domainPart] = parts;
      if (localPart.length <= 2) {
        return `${localPart.charAt(0) || '*'}***@${domainPart}`;
      }
      return `${localPart.slice(0, 2)}***@${domainPart}`;
    }
    ```
  - 两个 service 同属 `email` 领域，功能完全重叠。
- **影响**：
  - 维护时需同步修改两处，增加遗漏风险。
  - 违反 DRY 原则。
- **修复方案**：
  1. 将 `maskEmail` 抽取为 `src/modules/common/email-shared/` 下的共享工具函数。
  2. 或将 `maskEmail` 放入 `src/core/common/utils/` 中作为通用脱敏工具。
  3. 两个 service 改为导入共享函数。
- **涉及文件**：
  - `src/modules/common/email-worker/email-delivery.service.ts`
  - `src/modules/common/email-queue/email-queue.service.ts`
- **风险**：低。

---

## 7. `reference.report` Capability ID 常量残留（第三步 — 死代码/废弃常量）

- **状态**：[已解决] — REFERENCE_REPORT_CAPABILITY_ID 常量已从 reference-report.types.ts 中移除
- **严重度**：低
- **规范依据**：`docs/capabilities/current.md` — 无 `reference.report` 决策；稳定 reference 决策明确说 report 只是 composition usecase
- **现状**：
  - `src/types/reference/reference-report.types.ts` 第 3 行：`export const REFERENCE_REPORT_CAPABILITY_ID = 'reference.report' as const;`
  - 该常量在整个项目中无任何引用（Anchor 文件已移除，但类型常量残留）。
  - 同文件中的 `ReferenceReportItem` / `ReferenceReportView` 接口仍被 `build-reference-report.usecase.ts` 使用。
- **影响**：
  - 未使用的 Capability ID 常量增加代码噪音。
  - 与决策文档不一致，可能误导开发者认为 `reference.report` 是一个已声明的 capability。
- **修复方案**：
  1. 移除 `REFERENCE_REPORT_CAPABILITY_ID` 常量。
  2. 保留 `ReferenceReportItem` / `ReferenceReportView` 接口（仍有使用方）。
- **涉及文件**：
  - `src/types/reference/reference-report.types.ts`
- **风险**：极低。

---

## 8. `WechatProvider`（modules 层）TODO 占位实现在 DI 中活跃（B7 盲区 + 第三步）

- **状态**：[已解决] — modules 层 wechat.provider.ts 已删除（未被 DI 注册的死代码），infrastructure 层 WechatAuthProvider 的 HttpException 已替换为 DomainError
- **严重度**：低
- **规范依据**：`docs/common/modules.rules.md` — modules 层不应直接使用 HTTP 协议异常
- **现状**：
  - `src/modules/third-party-auth/providers/wechat.provider.ts` 实现 `ThirdPartyProvider` 接口，但 `exchangeCredential()` 直接抛出 `DomainError(THIRDPARTY_ERROR.PROVIDER_NOT_SUPPORTED)`，是 TODO 占位实现。
  - 该 Provider 在 `ThirdPartyAuthModule` 中通过 DI 注册到 `providerMapFactory`，是活跃代码。
  - infrastructure 层有对应的 `wechat-auth.provider.ts` 作为真正的实现。
  - modules 层的 `wechat.provider.ts` 不应存在——Provider 实现应属于 infrastructure 层。
- **影响**：
  - modules 层包含了 infrastructure 职责的代码（第三方认证 Provider 实现），违反分层规则。
  - 若 `wechat-auth.provider.ts`（infrastructure）已注册了 WECHAT token，则 modules 层的 `WechatProvider` 可能造成 DI 冲突。
- **修复方案**：
  1. 确认 `wechat-auth.provider.ts`（infrastructure）是否已注册 `THIRD_PARTY_PROVIDER_TOKENS.WECHAT`。
  2. 若是，移除 modules 层的 `wechat.provider.ts` 和其在 `ThirdPartyAuthModule` 中的注册。
  3. 若否，将 modules 层的 `WechatProvider` 移到 infrastructure 层。
- **涉及文件**：
  - `src/modules/third-party-auth/providers/wechat.provider.ts`
  - `src/modules/third-party-auth/third-party-auth.module.ts`
  - `src/infrastructure/third-party-auth/providers/wechat-auth.provider.ts`
  - `src/infrastructure/third-party-auth/third-party-auth-infrastructure.module.ts`
- **风险**：需确认 DI 注册不冲突。

---

## 9. auth 域 Usecase 大量直接依赖 account 域 modules 层实现

- **状态**：[已缓解]
- **严重度**：中
- **规范依据**：`docs/common/usecase.rules.md` — usecase 应通过 bounded context 的公共 API（contract/types）获取跨域服务，而非直接依赖另一域的 service 实现
- **现状**：
  - `src/usecases/auth/execute-login-flow.usecase.ts` 直接导入 `AccountService` 和 `AccountQueryService`（account 域 modules 层实现）。
  - `src/usecases/auth/login-with-password.usecase.ts` 直接导入 `AccountService` 和 `AccountQueryService`。
  - `src/usecases/auth/login-with-user-info.usecase.ts` 直接导入 `AccountSecurityService` 和 `AccountQueryService`。
  - `src/usecases/auth/validate-access-token-session.usecase.ts` 直接导入 `AccountQueryService`。
  - ESLint 跨域规则未报错，说明当前规则配置允许 usecase 通过 modules 层 service 获取跨域服务（usecase→modules 路径合规）。
  - 但这些 usecase 直接操作 account 域的 service 方法（而非通过 account 域的 contract），增加了耦合。
- **影响**：
  - auth 域 usecase 与 account 域 service 实现细节强耦合。
  - account 域 service 方法签名变更会直接影响 auth 域 usecase。
  - 但由于 ESLint 规则允许，当前不视为严格违规，而是设计改进点。
- **修复方案**（待评估）：
  1. 在 account 域的 `contracts/` 下定义 `AccountAuthContract`，暴露 auth 域需要的最小方法集。
  2. auth 域 usecase 改为依赖 contract 接口，而非直接导入 service 实现。
  3. infrastructure 层提供 contract 的实现（将 AccountService 适配为 contract 接口）。
- **涉及文件**：
  - `src/usecases/auth/execute-login-flow.usecase.ts`
  - `src/usecases/auth/login-with-password.usecase.ts`
  - `src/usecases/auth/login-with-user-info.usecase.ts`
  - `src/usecases/auth/validate-access-token-session.usecase.ts`
- **风险**：改动面较大，需评估投入产出比。

---

## 10. `JwtAuthGuard` 忽略 Passport `info` 参数（B1 盲区）

- **状态**：[已解决] — JwtAuthGuard 已检查 info 参数，将 TokenExpiredError/JsonWebTokenError/NotBeforeError 映射为精确的 DomainError
- **严重度**：低
- **规范依据**：全局认证契约 — 强制认证场景下安全性不受影响，但丢失了错误原因区分能力
- **现状**：
  - `src/adapters/api/graphql/guards/jwt-auth.guard.ts` 的 `handleRequest` 已增加 info 参数检查。
  - TokenExpiredError → DomainError(JWT_ERROR.TOKEN_EXPIRED)
  - JsonWebTokenError → DomainError(JWT_ERROR.TOKEN_INVALID)
  - NotBeforeError → DomainError(JWT_ERROR.TOKEN_NOT_BEFORE)
  - 其他认证失败 → DomainError(JWT_ERROR.AUTHENTICATION_FAILED)
- **影响**：已修复，客户端可区分精确的 token 错误原因。
- **修复方案**：已完成。
- **涉及文件**：
  - `src/adapters/api/graphql/guards/jwt-auth.guard.ts`
- **风险**：已验证 Filter 对新错误码有正确映射。

---

## 11. `reference.profile` Capability 未在决策文档声明（B5 盲区）

- **状态**：[已解决] — 已在 `docs/capabilities/current.md` 中补充 `reference.profile` 决策声明（mode: always-on, contributions: ReferenceProfileQueryHandler）

---

## 12. `reference-report.types.ts` 仅服务单个 usecase（B6 盲区）

- **状态**：[已解决] — 类型文件已移至 `src/usecases/reference/reference-report.types.ts`，消费方改为相对路径导入，原 `src/types/reference/reference-report.types.ts` 已删除

---

## 13. Infrastructure 层硬编码 URL 默认值（B8 盲区）

- **状态**：[已解决] — 所有硬编码 URL 已提取为文件顶部命名常量（`DEFAULT_WEAPP_API_BASE_URL`、`DEFAULT_GRAVATAR_BASE_URL`、`DEFAULT_CRAVATAR_BASE_URL`），与运行时逻辑分离

---

## 14. `register.types.ts` 中 `PreparedRegisterData` 注释引用 TypeORM 语义（B6 盲区）

- **状态**：[已解决] — 注释已从"用于 TypeORM 创建账户实体的数据结构"改为"用于创建账户的数据结构"，消除框架语义

---

## 第三轮 review 新发现问题（07-16 第三轮）

以下问题在第三轮全局架构检查（ESLint + import 级 + 方法体语义级 + 同功能二次实现 + docs 规范偏离）中新发现。

### 15. `async-task-record` 模块内 capability ID 字面量未使用同模块常量

- **状态**：[已解决] — 所有 `'runtime.async-task'` 字面量已替换为 `RUNTIME_ASYNC_TASK_CAPABILITY_ID` 常量
- **严重度**：低
- **规范依据**：`docs/common/capability.rules.md` — capability ID 应由对应的 capability anchor 文件单一定义、其他位置引用常量
- **现状**：
  - `src/modules/async-task-record/async-task-record.capability.ts` 定义了 `RUNTIME_ASYNC_TASK_CAPABILITY_ID = 'runtime.async-task'`。
  - 同模块内的以下文件仍使用字符串字面量 `'runtime.async-task'` 而非常量：
    - `src/modules/async-task-record/async-task-record.service.ts:411` — `this.capabilityStateReader.requireEnabled('runtime.async-task')`
    - `src/modules/async-task-record/queries/async-task-record.query.service.ts` — 6 处 `this.capabilityStateReader.requireEnabled('runtime.async-task')`（第 28、36、44、65、93、107 行）
  - 这些文件同属 `async-task-record` 模块，完全可以通过相对路径导入 `RUNTIME_ASYNC_TASK_CAPABILITY_ID` 常量。
- **影响**：
  - 字面量与常量定义形成并行口径，若 anchor 文件中的 ID 字符串发生重命名，这些位置不会自动同步，存在漂移风险。
  - 与项目中其他模块（如 ai-workflow 使用 `AI_EXECUTION_CAPABILITY_ID` 常量）的做法不一致。
- **修复方案**：
  1. 在 `async-task-record.service.ts` 中添加 `import { RUNTIME_ASYNC_TASK_CAPABILITY_ID } from './async-task-record.capability'`。
  2. 在 `async-task-record.query.service.ts` 中添加 `import { RUNTIME_ASYNC_TASK_CAPABILITY_ID } from '../async-task-record.capability'`。
  3. 将所有 `'runtime.async-task'` 字面量替换为 `RUNTIME_ASYNC_TASK_CAPABILITY_ID`。
- **涉及文件**：
  - `src/modules/async-task-record/async-task-record.service.ts`
  - `src/modules/async-task-record/queries/async-task-record.query.service.ts`
- **风险**：极低——同模块内替换，无跨域依赖。

### 16. `third-party-auth` 模块内 capability ID 字面量未使用同模块常量

- **状态**：[已解决] — 所有 `'identity.external-account'` 字面量已替换为 `IDENTITY_EXTERNAL_ACCOUNT_CAPABILITY_ID` 常量
- **严重度**：低
- **规范依据**：同 #15
- **现状**：
  - `src/modules/third-party-auth/third-party-auth.capability.ts` 定义了 `IDENTITY_EXTERNAL_ACCOUNT_CAPABILITY_ID = 'identity.external-account'`。
  - 同模块内的以下文件仍使用字符串字面量 `'identity.external-account'` 而非常量：
    - `src/modules/third-party-auth/third-party-auth.service.ts` — 6 处 `this.capabilityStateReader.requireEnabled('identity.external-account')`（第 66、99、150、180、239、264 行）
    - `src/modules/third-party-auth/queries/third-party-auth.query.service.ts` — 3 处 `this.capabilityStateReader.requireEnabled('identity.external-account')`（第 26、43、71 行）
  - 这些文件同属 `third-party-auth` 模块，完全可以通过相对路径导入 `IDENTITY_EXTERNAL_ACCOUNT_CAPABILITY_ID` 常量。
- **影响**：
  - 同 #15：字面量与常量定义形成并行口径，存在漂移风险。
  - 与项目惯例不一致。
- **修复方案**：
  1. 在 `third-party-auth.service.ts` 中添加 `import { IDENTITY_EXTERNAL_ACCOUNT_CAPABILITY_ID } from './third-party-auth.capability'`。
  2. 在 `third-party-auth.query.service.ts` 中添加 `import { IDENTITY_EXTERNAL_ACCOUNT_CAPABILITY_ID } from '../third-party-auth.capability'`。
  3. 将所有 `'identity.external-account'` 字面量替换为 `IDENTITY_EXTERNAL_ACCOUNT_CAPABILITY_ID`。
- **涉及文件**：
  - `src/modules/third-party-auth/third-party-auth.service.ts`
  - `src/modules/third-party-auth/queries/third-party-auth.query.service.ts`
- **风险**：极低——同模块内替换，无跨域依赖。

### 17. Capability Anchor `requires` 中的跨域 capability ID 字面量

- **状态**：[已缓解] — 为所有跨域字面量添加了保留注释，说明因模块依赖规则无法使用常量
- **严重度**：低
- **规范依据**：`docs/common/capability.rules.md` — capability ID 应引用常量；`docs/common/modules.rules.md` — 业务域 modules 禁止跨域直接依赖
- **现状**：
  以下位置使用跨域 capability ID 字面量，因跨域 import 被禁止而无法替换为常量：
  - `src/modules/auth/auth.capability.ts:11` — `requires: ['identity.account']`（auth → account）
  - `src/modules/third-party-auth/third-party-auth.capability.ts:12` — `requires: ['identity.account']`（third-party-auth → account）
  - `src/modules/common/ai-capability/ai-capability.providers.ts:19` — `requires: ['runtime.async-task']`（common → async-task-record）
  - `src/modules/common/email-queue/email-queue.service.ts:20` — `runtimeDependencies: [{ capabilityId: 'runtime.async-task', ... }]`（common → async-task-record）
  - `src/modules/common/email-worker/email-delivery.service.ts:22` — `runtimeDependencies: [{ capabilityId: 'runtime.async-task', ... }]`（common → async-task-record）
- **影响**：
  - 跨域字面量与常量定义形成并行口径，存在漂移风险。
  - 但这是模块依赖规则与 capability ID 常量引用规则之间的结构性冲突，当前无法在无规则变更的情况下消除。
- **修复方案**（待评估）：
  1. **方案 A**：在 `src/types/` 中新增 capability ID 注册表（如 `src/types/common/capability-ids.types.ts`），集中存放所有 capability ID 常量，anchor 文件和消费方均从 types 层导入。需评估这是否引入新的集中化反模式（违反 `docs/common/boundary-contract.rules.md` 中"不建立全局 boundary contract 层"的约束）。
  2. **方案 B**：将部分 capability ID 常量提升到 `src/modules/common/` 下（如 `runtime.async-task`），由 common 层拥有定义。需评估 capability ID 归属语义是否允许。
  3. **方案 C**：保持现状，接受跨域字面量为结构性例外，通过代码注释标明保留原因，并依赖 code review 防止漂移。
- **涉及文件**：
  - `src/modules/auth/auth.capability.ts`
  - `src/modules/third-party-auth/third-party-auth.capability.ts`
  - `src/modules/common/ai-capability/ai-capability.providers.ts`
  - `src/modules/common/email-queue/email-queue.service.ts`
  - `src/modules/common/email-worker/email-delivery.service.ts`
- **风险**：
  - 方案 A 有引入"全局 ports 层"反模式的风险。
  - 方案 B 需变更 capability 归属语义，可能影响 registry 依赖图。
  - 方案 C 最安全但未解决根因。

### 18. ESLint prettier 格式化问题

- **状态**：[已解决] — import 语句已调整为单行格式
- **严重度**：低
- **规范依据**：ESLint prettier 规则
- **现状**：
  - `src/usecases/reference/build-reference-report.usecase.ts:3:14` — import 语句换行格式与 prettier 配置不一致。
- **修复方案**：运行 `npx eslint --fix` 自动修复。
- **涉及文件**：
  - `src/usecases/reference/build-reference-report.usecase.ts`
- **风险**：无。

---

## 第三轮 review 验证结果

对第二轮标记为"已解决/已缓解/部分解决"的所有问题进行了验证：

| 检查项 | 结果 |
|--------|------|
| ESLint 架构规则 | ✅ 仅 1 个 prettier 格式化问题，无架构违规 |
| adapters 导入 modules 实现 | ✅ 无违规 |
| adapters 导入 infrastructure 实现 | ✅ 无违规 |
| usecases 导入 infrastructure 实现 | ✅ 无违规 |
| usecases 导入 adapters | ✅ 无违规 |
| core 导入框架 | ✅ 无违规 |
| types 导入 core/infrastructure | ✅ 无违规 |
| infrastructure 反向导入 usecases/modules | ✅ 无违规 |
| Service 公开方法返回 Entity (B2) | ✅ 所有 Entity 返回方法已为 private |
| Usecase 持有 Entity (B2) | ✅ Usecase 无 Entity import |
| QueryService mapper 接受 Entity (B2) | ✅ 已改为仅接受 Snapshot |
| Guard info 参数 (B1) | ✅ JwtAuthGuard 和 OptionalJwtAuthGuard 均处理 info |
| Filter 生产环境错误分类 (B1) | ✅ 生产环境保留大类错误码，仅隐藏业务细节 |
| Resolver 编排多 Usecase (B3) | ✅ 每个 Resolver 方法仅调用单一 Usecase |
| Resolver catch 吞异常 (B4) | ✅ 无 try-catch 模式 |
| Capability ID 与决策一致性 (B5) | ✅ 所有 Capability ID 均在 current.md 中声明 |
| types 层无运行时副作用 (B6) | ✅ 无 reflect-metadata/框架 import |
| types 层无 framework 常量 (B6) | ✅ bullmq.types.ts 已移除 |
| types 层无 infrastructure re-export (B6) | ✅ transaction.types.ts 已修复 |
| modules 层无 HttpService (B7) | ✅ 无违规 |
| 同域接口重复 (B7) | ✅ ThirdPartyProvider 仅在 contracts/ 定义 |
| 死代码 (B7) | ✅ WeAppProvider/WechatProvider/modules wechat 均已移除 |
| 硬编码 URL (B8) | ✅ 已提取为命名常量 |
| 硬编码 timeout (B8) | ✅ 无违规 |
| Filter 单测覆盖 (B9) | ✅ 覆盖 401/403/400/404/500 在生产/非生产环境 |
| maskEmail 重复 (同功能二次实现) | ✅ 已提取到 core/common/text/text.helper.ts |
| reference.report 残留 | ✅ 已完全移除 |
| CapabilityQueryBus 保留 (B5) | ⚠️ 仍保留——因 DispatcherReferenceProfileClient 消费方 |
| auth→account 直接依赖 | ⚠️ 仍保留——ESLint 允许，设计改进点 |

---

## 总结

| 状态 | 数量 | 编号 |
|------|------|------|
| 已解决 | 14 | #1, #2, #4, #5, #6, #7, #8, #10, #11, #12, #13, #14, #15, #16, #18 |
| 已缓解 | 2 | #9（auth→account 直接依赖——设计改进点），#17（跨域字面量——已添加保留注释） |
| 部分解决 | 1 | #3（仅保留 QueryBus——因 DispatcherReferenceProfileClient 消费方） |
| **合计未解决** | **0** | — |

第二轮修复涉及的文件：
- `src/modules/common/email-capability/email-capability.providers.ts` — 新增 NotificationEmailCapabilityAnchor
- `src/modules/common/email-capability/email-capability.module.ts` — 注册新 Anchor
- `docs/capabilities/current.md` — 补充 reference.profile 决策声明
- `src/usecases/reference/reference-report.types.ts` — 新增（从 types/ collocate）
- `src/usecases/reference/build-reference-report.usecase.ts` — 更新导入路径
- `src/types/reference/reference-report.types.ts` — 已删除
- `src/infrastructure/third-party-auth/providers/weapp-http.provider.ts` — URL 提取为常量
- `src/infrastructure/blog-storage/gravatar-avatar-generator.adapter.ts` — URL 提取为常量
- `src/infrastructure/blog-storage/cravatar-avatar-generator.adapter.ts` — URL 提取为常量
- `src/types/services/register.types.ts` — 注释去 TypeORM 语义
- `src/modules/account/base/services/account.service.ts` — createAccountEntity/createUserInfoEntity 改为 private
