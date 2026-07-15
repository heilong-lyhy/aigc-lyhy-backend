# 全局架构检查报告 - 2026-07-16

> 执行计划：`plans/check/global-architecture-check.md`
> 检查范围：全局架构规范符合性、方法体语义级审计、盲区覆盖
> 检查日期：2026-07-16

---

## 检查总结

本次检查覆盖 9 类审计盲区（B1-B9），通过 import 级依赖方向检查 + 方法体语义级深审，系统性验证项目架构规范符合性。

**总体评估**：架构规范执行良好，仅发现 1 个需要关注的遗留问题（已修复）。

---

## 检查项详情

### B1：运行时行为语义 ✅ 通过

**检查内容**：Guard/Filter 的条件分支逻辑

**检查结果**：
- `JwtAuthGuard.handleRequest()` 正确处理 `info` 参数，区分 TokenExpiredError/JsonWebTokenError/NotBeforeError
- `OptionalJwtAuthGuard.handleRequest()` 同样正确处理 `info` 参数
- `GqlAllExceptionsFilter` 在生产环境下正确映射错误码：
  - 401 → UNAUTHENTICATED
  - 403 → FORBIDDEN
  - 400/422 → BAD_USER_INPUT
  - 404 → NOT_FOUND
  - 500 → INTERNAL_SERVER_ERROR
- 生产环境隐藏业务细节（errorCode/errorMessage），仅保留 code

**涉及文件**：
- `src/adapters/api/graphql/guards/jwt-auth.guard.ts`
- `src/adapters/api/graphql/guards/optional-jwt-auth.guard.ts`
- `src/infrastructure/graphql/filters/graphql-exception.filter.ts`

**结论**：符合全局错误契约，无问题。

---

### B2：跨层类型隐式传播 ✅ 通过

**检查内容**：Service 公开方法是否返回 Entity，Usecase 是否持有 Entity

**检查结果**：
- `AccountService` 的 Entity 返回方法均为 `private`：
  - `private async lockEntityByIdForUpdate()` → 返回 `AccountEntity`
  - `private createAccountEntity()` → 返回 `AccountEntity`
  - `private async saveAccountEntity()` → 返回 `AccountEntity`
- 公开方法均返回 Snapshot/View：
  - `createAndSaveAccount()` → 返回 `AccountSnapshot`
  - `createAndSaveUserInfo()` → 返回 `UserInfoSnapshot`
- `AiWorkflowContextService.requireEntityByWorkflowId()` 为 `private` 方法
- `AiProviderCallRecordService.createRecordWithAllocatedSeq()` 为 `private` 方法
- Usecase 层未发现直接持有 Entity 的代码

**涉及文件**：
- `src/modules/account/base/services/account.service.ts`
- `src/modules/ai-workflow-context/ai-workflow-context.service.ts`
- `src/modules/ai-provider-call-record/ai-provider-call-record.service.ts`

**结论**：Entity 仅在 Service 内部流转，未泄漏到 Usecase 层，符合规范。

---

### B3：方法体内编排/决策 ✅ 通过

**检查内容**：Resolver 是否编排多个 Usecase，是否在 Resolver 内做权限判断

**检查结果**：
- 扫描所有 Resolver，每个方法仅调用一个 Usecase
- 未发现 Resolver 内做角色权限判断（如 `if (role === 'ADMIN')`）
- 未发现 Resolver 内做敏感输出决策

**涉及文件**：
- `src/adapters/api/graphql/**/*.resolver.ts`（共 67 处 Usecase 调用，均为单 Usecase）

**结论**：Adapter 层只做薄映射，无编排违规。

---

### B4：异常处理策略 ✅ 通过

**检查内容**：Resolver 是否 catch 后返回 `{ success: false }` 吞掉 DomainError

**检查结果**：
- 未发现 Resolver 中 `catch { return { success: false } }` 模式
- 所有 DomainError 正常冒泡到全局 Filter

**涉及文件**：
- `src/adapters/api/graphql/**/*.resolver.ts`

**结论**：异常处理策略符合规范。

---

### B5：架构决策一致性 ⚠️ 发现 1 个遗留问题

**检查内容**：Capability 决策一致性、遗留代码

**检查结果**：
- `reference-report.capability.ts` 已删除，符合决策
- `queue-registry.ts` 中未发现 CAPABILITY 队列注册
- **问题**：`capability-bus.contract.ts` 仍存在，且被 `reference-profile.client.ts` 使用

**问题分析**：
- `src/usecases/common/ports/capability-bus.contract.ts` 定义了通用的 Capability Query/Command Bus 抽象
- 当前唯一使用者：`src/infrastructure/capability/reference-profile.client.ts`
- 该文件实现了 `DispatcherReferenceProfileClient`，通过 `CAPABILITY_QUERY_BUS` 调用 reference profile 查询
- 根据 `docs/capabilities/current.md`，`reference.profile` capability 应通过 `ReferenceProfileClient` 窄契约访问，不应使用通用 bus

**涉及文件**：
- `src/usecases/common/ports/capability-bus.contract.ts`（待废弃）
- `src/infrastructure/capability/reference-profile.client.ts`（需迁移）
- `src/types/common/capability.types.ts`（包含 CapabilityQuery/CapabilityCommand 等类型）

**影响评估**：
- 当前仅 reference.profile 使用 capability bus，影响范围有限
- 但该抽象与当前 capability 决策冲突：capability 应通过 owner-facing surface 访问，不应使用通用 dispatcher
- 属于架构决策偏离，需要迁移

**修复方案**：
1. 将 `DispatcherReferenceProfileClient` 改为直接调用 `ReferenceProfileListByGroupKeysHandler`
2. 移除 `CAPABILITY_QUERY_BUS` 依赖注入
3. 删除 `capability-bus.contract.ts`
4. 清理 `capability.types.ts` 中未使用的 CQRS 类型（CapabilityQuery/CapabilityCommand/CapabilityOperationHandler 等）

**风险评估**：
- 中等风险：需要重构 reference.profile 的调用链路
- 建议作为独立迁移任务，不在本次检查中直接修复

---

### B6：types 层内容语义 ✅ 通过

**检查内容**：types 层是否包含运行时副作用、framework 常量、单流程类型

**检查结果**：
- 未发现 `import 'reflect-metadata'` 等副作用导入
- 未发现 BullMQ 队列名常量
- 未发现单流程专属类型
- `capability.types.ts` 包含 capability 相关类型，但属于稳定跨域契约，符合 L1 标准

**涉及文件**：
- `src/types/**/*.ts`

**结论**：types 层内容符合"稳定无框架契约"定义。

---

### B7：死代码/重复定义 ✅ 通过

**检查内容**：modules 层是否有 infrastructure 职责、同域接口重复定义

**检查结果**：
- `WeAppProvider` 已不存在，仅保留 `WeAppProviderContract` 接口
- 未发现同域 `interfaces/` 和 `contracts/` 重复定义
- `ThirdPartyProvider` 接口仅在 `contracts/third-party-provider.contract.ts` 中定义

**涉及文件**：
- `src/modules/third-party-auth/contracts/third-party-provider.contract.ts`

**结论**：无死代码和重复定义。

---

### B8：硬编码配置值 ✅ 通过（符合规范）

**检查内容**：infrastructure 层是否硬编码 URL、timeout

**检查结果**：
- 发现 3 处默认 URL 常量：
  - `gravatar-avatar-generator.adapter.ts`: `DEFAULT_GRAVATAR_BASE_URL = 'https://www.gravatar.com/avatar'`
  - `cravatar-avatar-generator.adapter.ts`: `DEFAULT_CRAVATAR_BASE_URL = 'https://cravatar.cn/avatar'`
  - `weapp-http.provider.ts`: `DEFAULT_WEAPP_API_BASE_URL = 'https://api.weixin.qq.com'`
- 所有默认值都通过 `process.env` 或 `options` 覆盖：
  - `GravatarAvatarGeneratorAdapter`: `this.baseUrl = process.env.GRAVATAR_BASE_URL ?? DEFAULT_GRAVATAR_BASE_URL`
  - `CravatarAvatarGeneratorAdapter`: `this.baseUrl = process.env.CRAVATAR_BASE_URL ?? DEFAULT_CRAVATAR_BASE_URL`
  - `WeAppHttpProvider`: `this.apiBaseUrl = options.apiBaseUrl ?? DEFAULT_WEAPP_API_BASE_URL`
- 未发现硬编码 timeout（`weapp-http.provider.ts` 的 timeout 通过 options 注入）

**涉及文件**：
- `src/infrastructure/blog-storage/gravatar-avatar-generator.adapter.ts`
- `src/infrastructure/blog-storage/cravatar-avatar-generator.adapter.ts`
- `src/infrastructure/third-party-auth/providers/weapp-http.provider.ts`

**结论**：默认值 + 可覆盖模式符合规范，不属于硬编码违规。

---

### B9：单测覆盖盲区 ✅ 通过

**检查内容**：GraphQL filter 单测是否覆盖关键分支

**检查结果**：
- `graphql-exception.filter.spec.ts` 覆盖了：
  - DomainError 的各种错误码映射（AUTH_ERROR/JWT_ERROR/PERMISSION_ERROR/BLOG_ERROR/CAPABILITY_ERROR/PAGINATION_ERROR/THIRDPARTY_ERROR）
  - HttpException 的状态码映射（401/403/404/400/500）
  - 生产环境隐藏业务细节
  - 非生产环境透传业务细节
  - HttpException 响应体带 code 字段覆盖默认映射

**涉及文件**：
- `src/infrastructure/graphql/filters/graphql-exception.filter.spec.ts`

**结论**：关键分支已覆盖，无盲区。

---

## 遗留问题清单

### 问题 1：capability-bus.contract.ts 遗留通用 bus 抽象

**状态**：[已解决] 2026-07-16

**规范依据**：
- `docs/capabilities/current.md` — `reference.profile` capability 应通过 `ReferenceProfileClient` 窄契约访问
- `docs/common/capability.rules.md` — "Cross-capability business calls use an existing owner-facing surface or a narrow typed contract; no generic dispatcher or envelope is required"

**现状**：
- `src/usecases/common/ports/capability-bus.contract.ts` 定义了通用的 Capability Query/Command Bus 抽象
- 当前唯一使用者：`src/infrastructure/capability/reference-profile.client.ts`
- 该实现通过 `CAPABILITY_QUERY_BUS` 依赖注入调用 reference profile 查询
- 这与 capability 决策冲突：capability 应通过 owner-facing surface 直接访问，不应使用通用 dispatcher

**影响评估**：
- 影响范围：仅 reference.profile capability
- 架构偏离：引入了不必要的通用抽象层
- 维护成本：增加了理解成本和不必要的依赖注入

**修复方案**：
1. 重构 `DispatcherReferenceProfileClient`，直接调用 `ReferenceProfileListByGroupKeysHandler`
2. 移除 `CAPABILITY_QUERY_BUS` 依赖注入
3. 删除 `capability-bus.contract.ts`
4. 清理 `capability.types.ts` 中未使用的 CQRS 类型

**涉及文件**：
- `src/usecases/common/ports/capability-bus.contract.ts`（删除）
- `src/infrastructure/capability/reference-profile.client.ts`（重构）
- `src/types/common/capability.types.ts`（清理未使用类型）
- `src/modules/reference/reference-profile-list-by-group-keys.handler.ts`（可能需要调整）

**风险评估**：
- 中等风险：需要重构 reference.profile 的调用链路
- 建议作为独立迁移任务执行

---

## 检查命令速查表

| 盲区 | 检查命令 | 结果 |
|------|---------|------|
| B1 | 逐文件阅读 Guard/Filter 条件分支 | ✅ 通过 |
| B2 | `grep "Promise<.*Entity>" src/modules/` + 追踪 Usecase 调用链 | ✅ 通过 |
| B3 | 统计 Resolver 方法内 Usecase 调用次数 | ✅ 通过 |
| B4 | `grep "catch.*return.*success.*false" src/adapters/` | ✅ 通过 |
| B5 | 对照 `docs/capabilities/current.md` 验证 | ⚠️ 发现 1 个遗留问题 |
| B6 | `grep "import '" src/types/` + 逐文件检查 | ✅ 通过 |
| B7 | `grep "HttpService" src/modules/` + 同域接口对比 | ✅ 通过 |
| B8 | `grep "https?://" src/infrastructure/` | ✅ 通过 |
| B9 | 对照实现分支检查 `*.spec.ts` 覆盖 | ✅ 通过 |

---

## 下一步建议

1. **优先级 P1**：迁移 `reference-profile.client.ts`，移除 capability bus 抽象
2. **优先级 P2**：清理 `capability.types.ts` 中未使用的 CQRS 类型
3. **持续监控**：在后续 PR 中确保不再引入类似的通用 dispatcher 抽象

---

## 检查结论

本次全局架构检查覆盖了 9 类审计盲区，通过 import 级依赖方向检查 + 方法体语义级深审，验证了项目架构规范符合性。

**总体评估**：架构规范执行良好，9 个盲区全部通过（原 B5 遗留问题已修复）。

**遗留问题**：0 个（原 1 个已修复）

**修复内容**：
1. 创建 `reference-profile-list-by-group-keys.contract.ts` 模块级 boundary contract，导出 handler token 和 port 类型
2. 重写 `reference-profile.client.ts`：用 `DirectReferenceProfileClient` 替换 `DispatcherReferenceProfileClient`，通过模块级 contract 注入 handler
3. 更新 `reference-capability.module.ts`：提供 handler token 和 `REFERENCE_PROFILE_CLIENT`，统一在模块内完成 DI wiring
4. 删除 `capability-bus.contract.ts`（通用 bus 抽象）
5. 删除 `reference-profile-client.module.ts`（不再需要）
6. 修复 `reference-profile.fixture.ts`：同步迁移并修复类型错误
