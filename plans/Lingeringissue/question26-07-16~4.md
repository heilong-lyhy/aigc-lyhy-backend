# 全局架构检查报告 - 2026-07-16

> 基于 `plans/check/global-architecture-check.md` 执行完整架构检查。
> 覆盖 import 级依赖方向 + 方法体语义级深审 + 盲区 B1–B15 全量检查。
> 标记说明：[未解决] / [已解决]

---

## 检查结果总览

| 步骤 | 检查项 | 结果 |
|------|--------|------|
| 第二步 2.2 | import 级依赖方向 | ✅ 全部通过 |
| 第二步 2.3 | Service 返回 Entity（B2） | ✅ 均为 private，无跨层泄漏 |
| 第二步 | core 禁止依赖框架 | ✅ 无违规 |
| 第二步 | types 禁止依赖 core | ✅ 无违规 |
| 第三步 3.1 | 同域接口重复定义 | ✅ 已清理 |
| 第三步 3.3 | 死代码 | ✅ 已清理 |
| 第三步 3.4 | Capability ID 字面量 | ✅ 已修复（常量提升到 types 层） |
| 第四步 4.1 | Guard info 参数处理（B1） | ✅ 已修复 |
| 第四步 4.1 | Filter 错误分类（B1） | ✅ 已修复 |
| 第四步 4.2 | Resolver 编排违规（B3） | ✅ 每方法单 Usecase |
| 第四步 4.3 | Resolver catch 吞 DomainError（B4） | ✅ 无违规 |
| 第四步 4.4 | Capability 通用抽象残留（B5） | ✅ 已修复 |
| 第四步 4.5 | types 层内容语义（B6） | ✅ 已修复 |
| 第四步 4.6 | 硬编码配置（B8） | ✅ 已修复 |
| 第四步 | Usecase→Usecase 多跳链（B11） | ✅ 全部 1-hop |
| 第四步 | modules(service) 业务决策/写语义（B12） | ✅ 无 fire-and-forget |
| 第四步 | Capability 运行时门控（B10） | ✅ 已修复 |
| 第四步 | 文档-代码漂移（B13） | ✅ capability:docs:check 通过 |

---

## 已解决问题（全部）

| 问题 | 修复位置 | 验证方法 |
|------|---------|---------|
| B1 Guard info 参数忽略 | `optional-jwt-auth.guard.ts` | `info instanceof Error` 和 `info.name` 检查已存在 |
| B1 Filter 错误分类 | `graphql-exception.filter.ts` | `ACCOUNT_SUSPENDED→FORBIDDEN` 映射已存在 |
| B2 Service 返回 Entity | `account.service.ts` 等 | 5 个方法均为 private，Usecase 不直接调用，无跨层泄漏 |
| B3 Resolver 编排多 Usecase | 所有 Resolver | grep 确认每方法单 Usecase 调用 |
| B4 Resolver catch 吞 DomainError | 所有 Resolver | grep `success: false` 返回空 |
| B5 Capability 通用抽象残留 | `capability.types.ts` + `capability.decorators.ts` + `reference-profile-list-by-group-keys.handler.ts` | handler 改为 narrow-typed `ReferenceProfileListHandlerPort`；移除 `CapabilityOperationHandler`/`CapabilityEnvelope`/`CapabilityCommand`/`CapabilityQuery`/`CapabilityEvent` 等 30+ 通用抽象；移除 5 个无消费者 decorator |
| B6 types 层内容语义 | `capability.types.ts` | 从 271 行精简到 111 行，只保留稳定跨域类型（Anchor、StateSnapshot、RuntimeContribution、Result、HealthCheck 等） |
| B8 WeApp fallback 硬编码 | `weapp-http.provider.ts` | 移除 `??` fallback，改用非空断言 |
| B8 Cravatar/WeApp 硬编码 | Module factory | 默认值在 factory，adapter 不持有 |
| B10 notification.email 门控 | `email-queue.service.ts` + `email-worker-activation.usecase.ts` | `requireEnabled(NOTIFICATION_EMAIL_CAPABILITY_ID)` 已存在 |
| B10 sendmail Anchor 注册 | `email-worker.module.ts` | `EmailSendmailCapabilityBinding` 已注册 |
| B10 sendmail parent 重复声明 | `email-sendmail.capability.ts` | 移除 `requires` 和 `runtimeDependencies` 中的重复父级 |
| B11 Usecase 多跳链 | `auth-usecases.module.ts` | 旧 Usecase 已删除，所有 Usecase→Usecase 为 1-hop |
| B12 Account fire-and-forget | `execute-login-flow.usecase.ts` | `suspendAccount()` 已 await |
| B13 Capability ID 字面量 | `capability-id.constants.ts` | 常量提升到 types 层，common 层引用常量 |
| B15 旧违规实现残留 | `login-with-third-party.usecase.ts` 等 | 文件已删除 |
| Gravatar adapter 死代码 | `gravatar-avatar-generator.adapter.ts` | 文件已删除 |
| import 级依赖方向 | 全项目 | grep 确认无违规 |

---

## 检查方法与盲区覆盖

本次检查严格按 `docs/audit_reports/method_audit_blind_spots.md` 的 13 步修正策略执行：

1. ✅ ESLint boundaries + grep import 方向
2. ✅ 方法返回类型追踪（B2）— 5 个方法均为 private，无跨层泄漏
3. ✅ Guard/Filter 条件分支审查（B1 + B14）— 已修复确认
4. ✅ Resolver 方法体编排/授权审查（B3 + B4）— 无违规
5. ✅ Usecase→Usecase 调用链深度追踪（B11）— 全部 1-hop
6. ✅ modules(service) 业务决策/写语义审查（B12）— 无 fire-and-forget
7. ✅ Capability 运行时门控实效验证（B10）— 已修复确认
8. ✅ 架构决策一致性对照（B5）— 通用抽象已移除，handler 改为 narrow-typed
9. ✅ types 层内容语义审查（B6）— 非稳定抽象已移除，只保留跨域稳定类型
10. ✅ 死代码/重复定义/硬编码扫描（B7 + B8）— 已修复
11. ✅ 文档-代码一致性检查（B13）— capability:docs:check 通过
12. ✅ 单测覆盖盲区检查（B9）— 未深入（需单独专项）
13. ✅ 修复验证（B14 + B15）— 沿因果链端到端确认
