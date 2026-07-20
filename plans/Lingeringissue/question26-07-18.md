# 全局架构检查报告 - 2026-07-18

> 基于 `plans/check/global-architecture-check.md` 执行完整架构检查（第二轮独立复审）。
> 覆盖 import 级依赖方向 + 方法体语义级深审 + 盲区 B1–B15 全量检查。
> 标记说明：[未解决] / [已解决]

---

## 检查结果总览

| 步骤 | 检查项 | 结果 |
|------|--------|------|
| 2.1 | ESLint 架构规则检查 | ✅ 通过（修复 9 个 prettier/duplicate-import 错误） |
| 2.2 | import 级依赖方向 | ✅ 全部通过 |
| 2.2 | adapters → modules/infrastructure | ✅ 无违规 |
| 2.2 | usecases → infrastructure/adapters | ✅ 无违规 |
| 2.2 | core → 框架/上游层 | ✅ 无违规 |
| 2.2 | types → core | ✅ 无违规 |
| 2.2 | infrastructure → usecases/modules | ✅ 仅 import *.contract.ts（允许） |
| 2.3 | Service 返回 Entity（B2） | ✅ 5 个方法均为 private，无跨层泄漏 |
| 3.1 | 同域接口重复定义 | ✅ 无 |
| 3.3 | 死代码 | ✅ 无 |
| 3.4 | Capability ID 字面量 | ✅ 常量提升到 types 层（spec 字面量为例外，符合测试惯例） |
| 4.1 | Guard info 参数处理（B1） | ✅ 已修复 |
| 4.1 | Filter 错误分类（B1） | ✅ 已修复 |
| 4.2 | Resolver 编排违规（B3） | ✅ 每方法单 Usecase |
| 4.3 | Resolver catch 吞 DomainError（B4） | ✅ 无违规 |
| 4.4 | Capability 通用抽象残留（B5） | ✅ 已彻底修复 |
| 4.5 | types 层内容语义（B6） | ✅ 已彻底修复 |
| 4.6 | 硬编码配置（B8） | ✅ Module factory fallback 可接受 |
| 4.7 | 单测覆盖（B9） | ✅ Filter/Guard 测试覆盖充分 |
| B10 | Capability 运行时门控 | ✅ 已修复 |
| B11 | Usecase 多跳链 | ✅ 全部 1-hop |
| B12 | modules(service) 业务决策 | ✅ 无 fire-and-forget |
| B13 | 文档-代码漂移 | ✅ capability:docs:check 通过 |

---

## 本次检查新发现并修复的问题

### 问题 1：ESLint 格式化和重复 import 违规 [已解决]

**规范依据**：`docs/common/eslint-architecture-rules.md`

**现状描述**：
- `src/usecases/auth/login-with-user-info.usecase.ts` 存在 `@app-types/models/account.types` 重复 import（违反 `no-duplicate-imports`）
- 4 个文件存在 prettier 格式化问题：
  - `src/infrastructure/blog-storage/blog-storage.module.ts`
  - `src/infrastructure/third-party-auth/third-party-auth-infrastructure.module.ts`
  - `src/modules/common/email-queue/email-queue.service.ts`
  - `src/modules/common/email-worker/email-delivery.service.ts`
  - `src/usecases/auth/login-with-user-info.usecase.ts`

**影响评估**：低 — 不影响运行时行为，但违反代码规范

**修复方案**：
- 合并 `login-with-user-info.usecase.ts` 的重复 import
- 运行 `npx eslint --fix` 自动修复 prettier 格式化问题

**涉及文件**：
- [login-with-user-info.usecase.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/usecases/auth/login-with-user-info.usecase.ts)
- [blog-storage.module.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/infrastructure/blog-storage/blog-storage.module.ts)
- [third-party-auth-infrastructure.module.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/infrastructure/third-party-auth/third-party-auth-infrastructure.module.ts)
- [email-queue.service.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/modules/common/email-queue/email-queue.service.ts)
- [email-delivery.service.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/modules/common/email-worker/email-delivery.service.ts)

**风险评估**：低 — 纯格式化修复

---

### 问题 2：Guard 测试期望与实现不一致 [已解决]

**规范依据**：全局认证契约（B1 修复的关联问题）

**现状描述**：
- `optional-jwt-auth.guard.spec.ts` 第 28 行期望 `handleRequest(err, false, null)` 抛出原始 `err` Error
- 实际实现第 50 行抛出 `UnauthorizedException('认证失败')`（B1 修复后的正确行为）
- 第 33 行期望 `handleRequest(null, false, info)` 抛出原始 `info` Error
- 实际实现第 56 行抛出 `UnauthorizedException('认证失败: jwt malformed')`（B1 修复后的正确行为）

**影响评估**：中 — 测试期望与实现不一致，2 个测试失败

**修复方案**：
- 修改测试期望为 `toThrow(UnauthorizedException)` 和 `toThrow('认证失败')`
- 保持实现不变（实现是 B1 修复后的正确行为）

**涉及文件**：
- [optional-jwt-auth.guard.spec.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/adapters/api/graphql/guards/optional-jwt-auth.guard.spec.ts)

**风险评估**：低 — 测试期望修正，不影响实现逻辑

---

## 前次修复（2026-07-16 ~4 报告之后）新发现并修复的问题

### 问题 3：无消费者的 Capability decorator [已解决]

**规范依据**：`docs/common/capability.rules.md` — "Do not add generic session, permission, GraphQL surface, provider-binding, queue-binding, or operation registries without a real production behavior that cannot remain explicit."

**现状描述**：
- `@CapabilityProviderBindingProvider`、`@CapabilityQueueBindingProvider`、`@CapabilityHealthCheckProvider` 注册的 metadata 从未被 `CapabilityRegistry` 或任何其他地方消费
- `isCapabilityHealthCheck` 函数从未被调用
- 这些 decorator 违反了 "no generic registries without real production behavior" 规则

**修复方案**：
- 从 `capability.decorators.ts` 移除 3 个 decorator 和 `isCapabilityHealthCheck` 函数
- 只保留 `CapabilityAnchorProvider` 和 `CapabilityRuntimeContributionProvider`（有实际消费者）
- 清理 `EmailSendmailCapabilityBinding` 上的无消费者 decorator 和 `check()` 方法

**涉及文件**：
- [capability.decorators.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/infrastructure/capability/capability.decorators.ts)
- [email-sendmail.capability.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/modules/common/email-worker/email-sendmail.capability.ts)

---

### 问题 4：CapabilityErrorCode 重复定义 [已解决]

**规范依据**：`docs/common/type.rules.md` — "业务错误码单一真源：`src/core/common/errors/domain-error.ts`" + "`src/types` 禁止依赖 `src/core`"

**现状描述**：
- `src/types/common/capability.types.ts` 定义了 13 个 `CapabilityErrorCode` 错误码
- `src/core/common/errors/domain-error.ts` 定义了 1 个错误码（`'CAPABILITY_UNAVAILABLE'`）
- 两者完全不同，且 `capability.types.ts` 中的 `code` 字段从未被读取
- 违反 "单一真源" 和 "types 禁止依赖 core" 规则

**修复方案**：
- 从 `capability.types.ts` 移除 `CapabilityErrorCode` 类型
- 将 `CapabilityError.code` 改为 `string` 类型
- 业务错误码单一真源保持在 `src/core/common/errors/domain-error.ts`

**涉及文件**：
- [capability.types.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/types/common/capability.types.ts)

---

### 问题 5：无消费者的类型定义 [已解决]

**规范依据**：`docs/common/type.rules.md` — L1 层仅保留稳定跨域复用类型

**现状描述**：
- `CapabilityHealthReport`、`CapabilityHealthCheck`、`CapabilityHealthResult`、`CapabilityOperationKind`、`CapabilityProviderKind` 只被已移除的无消费者 decorator 使用
- 违反 L1 层 "跨域复用" 要求

**修复方案**：
- 从 `capability.types.ts` 移除这 5 个类型
- 文件从 111 行精简到 76 行

**涉及文件**：
- [capability.types.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/types/common/capability.types.ts)

---

### 问题 6：文件命名不符合规范 [已解决]

**规范依据**：`docs/common/type.rules.md` — "文件名统一 `*.types.ts`"

**现状描述**：
- `capability-id.constants.ts` 违反 `*.types.ts` 命名规范

**修复方案**：
- 重命名为 `capability-id.types.ts`
- 更新 4 个 import 路径

**涉及文件**：
- [capability-id.types.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/types/common/capability-id.types.ts)
- [async-task-record.capability.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/modules/async-task-record/async-task-record.capability.ts)
- [email-delivery.service.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/modules/common/email-worker/email-delivery.service.ts)
- [email-queue.service.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/modules/common/email-queue/email-queue.service.ts)
- [ai-capability.providers.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/modules/common/ai-capability/ai-capability.providers.ts)

---

### 问题 7：无消费者常量 [已解决]

**现状描述**：
- `EMAIL_DELIVERY_PROVIDER_KIND`、`EMAIL_SENDMAIL_PROVIDER_NAME` 只被已移除的 `@CapabilityProviderBindingProvider` 使用

**修复方案**：
- 从 `email-capability.constants.ts` 移除这两个常量

**涉及文件**：
- [email-capability.constants.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/modules/common/email-capability/email-capability.constants.ts)

---

## 验证结果

- **TypeScript 编译**：`npx tsc --noEmit` 通过
- **ESLint**：`npx eslint "{src,apps,libs,test}/**/*.ts" --cache` 通过
- **capability:docs:check**：通过
- **测试套件**：101 个测试套件，715 个测试全部通过

---

## 检查方法与盲区覆盖

本次检查严格按 `docs/audit_reports/method_audit_blind_spots.md` 的 13 步修正策略执行：

1. ✅ ESLint boundaries + grep import 方向
2. ✅ 方法返回类型追踪（B2）— 5 个方法均为 private，无跨层泄漏
3. ✅ Guard/Filter 条件分支审查（B1 + B14）— 已修复确认，测试期望修正
4. ✅ Resolver 方法体编排/授权审查（B3 + B4）— 无违规
5. ✅ Usecase→Usecase 调用链深度追踪（B11）— 全部 1-hop
6. ✅ modules(service) 业务决策/写语义审查（B12）— 无 fire-and-forget
7. ✅ Capability 运行时门控实效验证（B10）— 已修复确认
8. ✅ 架构决策一致性对照（B5）— 通用抽象已彻底移除，无消费者 decorator 已清理
9. ✅ types 层内容语义审查（B6）— 无消费者类型已移除，ErrorCode 重复已修复
10. ✅ 死代码/重复定义/硬编码扫描（B7 + B8）— Module factory fallback 可接受
11. ✅ 文档-代码一致性检查（B13）— capability:docs:check 通过
12. ✅ 单测覆盖盲区检查（B9）— Filter/Guard 测试覆盖充分，测试期望已修正
13. ✅ 修复验证（B14 + B15）— 沿因果链端到端确认，715 个测试全部通过
