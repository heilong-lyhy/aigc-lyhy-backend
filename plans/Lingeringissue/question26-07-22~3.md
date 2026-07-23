# 遗留问题清单 - 2026-07-22（全局架构检查第三轮复审）

> 本文件记录 2026-07-22 第三轮全局复审（执行 `plans/check/global-architecture-check.md`）中新发现的问题。
> 标记说明：[未解决] / [已解决]
> 上下文：本次复审确认前两轮所有修复（含 question26-07-22~2.md 的两项）均生效，B1–B14 盲区整体仍绿，仅新发现 1 项 B7 重复实现遗漏。

---

## 1. `user-info.resolver.ts` 三个 private 映射方法与共享 mapper 重复

- **状态**：[已解决 2026-07-22]
- **规范依据**：`docs/api/adapters.rules.md` — adapter 间不得复制粘贴同一映射逻辑；`docs/audit_reports/method_audit_blind_spots.md` B7（重复实现）
- **现状**：
  - [user-info.resolver.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/adapters/api/graphql/account/user-info.resolver.ts) 内有三个 private 方法，与已存在的共享 mapper [user-info.mapper.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/adapters/api/graphql/account/dto/user-info.mapper.ts) **逐字重复**：
    1. `private mapViewToDTO(view: UserInfoView): UserInfoDTO`（第 83–113 行）—— 与 mapper 的 `mapUserInfoViewToDTO` 字段、顺序完全一致。
    2. `private mapViewToBasicDTO(view: UserInfoView): BasicUserInfoDTO`（第 118–127 行）—— 与 mapper 的 `mapUserInfoViewToBasicDTO` 完全一致。
    3. `private serializeGeographic(geo: {...} | null): string | null`（第 120–127 行）—— 与 mapper 的 `serializeGeographic` 逻辑完全一致（仅参数类型写法略有差异，mapper 用 `GeographicInfo | null`，本处用内联结构类型 `{ province?: string | null; city?: string | null } | null`，语义等价）。
  - 该 resolver 同时 import 了 `UserInfoDTO`（来自 `./dto/user-info.dto`）和 `BasicUserInfoDTO`（来自 `./dto/basic-user-info.dto`），但未 import 同目录下共享 mapper 的纯函数。
  - **历史背景**：question26-07-22~2.md 已修复 `auth.resolver.ts` 与 `third-party-auth.resolver.ts` 的同类重复，但当时未扫描到 `user-info.resolver.ts`，本轮复审通过 `grep "private\s+(map\w+ToDTO|serialize\w+)"` 才发现这第三个副本。
- **影响**：
  - 维护不同步风险：`UserInfoDTO`/`BasicUserInfoDTO` 字段调整或脱敏规则变化时需同步改 mapper + 本 resolver，易遗漏。
  - 同一项目内同一映射逻辑存在三份真源（mapper 一份、本 resolver 一份，此前两份已收敛），违反"单一实现"原则。
  - 不涉及跨层违规：均在 adapter 层内，依赖关系正常。
- **修复方案**：让 `user-info.resolver.ts` 改为 `import { mapUserInfoViewToBasicDTO, mapUserInfoViewToDTO } from './dto/user-info.mapper'`，删除三个 private 方法。三个调用点替换为 mapper 函数调用。清理因方法删除而不再使用的 import `UserInfoView`（`GeographicInfo` 仍被 `updateUserInfo` 的 `geoPatch` 使用，保留）。
- **涉及文件**：
  - [user-info.resolver.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/adapters/api/graphql/account/user-info.resolver.ts) — 删除三个 private 方法，改用 mapper import，清理 `UserInfoView` import
  - [user-info.mapper.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/adapters/api/graphql/account/dto/user-info.mapper.ts) — 无需改动（已提供全部三个函数）
- **风险**：极低。纯映射函数迁移，无副作用、无状态。
- **验证**：
  - `npm run typecheck` 通过（exit 0）。
  - `npx eslint user-info.resolver.ts` 通过（exit 0，无报错）。
  - `npx jest --testPathPatterns="(user-info|account)"` 4 个测试套件 / 44 个用例全通过。
  - 确认重复消除：`grep -rn "private mapViewToDTO\|private mapViewToBasicDTO\|private serializeGeographic" src/adapters/` 无匹配。

---

## 本轮复审已确认生效的历史修复（B1–B14）

> 以下盲区在第三轮复审中逐项验证，均仍生效。

| 盲区 | 结论 | 关键证据 |
|------|------|---------|
| B1 运行时行为语义 | ✅ | `jwt-auth.guard.ts` 第 59–67 行处理 `info`（TokenExpiredError/JsonWebTokenError/NotBeforeError）；`optional-jwt-auth.guard.ts` 同样处理 `info`；`graphql-exception.filter.ts` `mapHttpToGqlCode` 第 25–40 行 401→UNAUTHENTICATED、403→FORBIDDEN |
| B2 用例持有 Entity | ✅ | `AccountQueryService` 返回 View/Snapshot |
| B3 Resolver 内编排 | ✅ | `AuthResolver`/`ThirdPartyAuthResolver` 仅调单一 `LoginWithUserInfoUsecase` |
| B4 异常处理策略 | ✅ | Resolver 无 `catch DomainError` 返回 `success:false`；`schema.init.ts` 的 `success:false` 是幂等守卫非异常吞没 |
| B5 capability bus 残留 | ✅ | `capability-bus`/`reference-report.capability` 全仓库无匹配 |
| B6 types 层纯洁性 | ✅ | `src/types/` import 全部为 types 内部相对路径，无 core/框架导入 |
| B7 重复接口/HttpService/WeAppProvider | ⚠️ 部分 | `ThirdPartyProvider` 单一定义；modules 无 `HttpService`；WeAppProvider 在 modules 仅引用 `WeAppProviderContract` 契约；**但 `user-info.resolver.ts` 仍有映射方法重复（见本文件问题 1）** |
| B8 硬编码 URL/超时 | ✅ | `src/infrastructure` 无硬编码 `timeout:\d+`；adapter 无 `process.env` |
| B9 事务边界 | ✅ | usecase 层无数据库 `.save()/.insert()/.update()`（仅 `createHash().update()` crypto 调用） |
| B10 capability 运行时门控 | ✅ | `EmailQueueService.enqueueSend` 双门控 `requireEnabled(NOTIFICATION_EMAIL_CAPABILITY_ID)` + `requireEnabled(RUNTIME_EMAIL_DELIVERY_CAPABILITY_ID)` |
| B11 Usecase 多跳链 | ✅ | `LoginWithUserInfoUsecase` 扁平编排，同级 1 hop（ExecuteLoginFlow/DecideRole/EnrichIdentity） |
| B12 Modules 业务决策/写语义 | ✅ | `AccountSecurityService.validateAccessGroupConsistency` 返回 `{shouldSuspend}` 纯方法；`suspendAccount` 独立写方法 |
| B13 文档-代码漂移 | ✅ | 文档与代码一致 |
| B14 修复验证 | ✅ | 配置已集中，adapter 不读 `process.env` |

## 关联

- 触发检查计划：[global-architecture-check.md](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/plans/check/global-architecture-check.md)
- 上一轮问题：[question26-07-22~2.md](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/plans/Lingeringissue/question26-07-22~2.md)（jwt.config.ts 死代码 + auth/third-party-auth resolver 重复映射，均已解决）
- 盲区定义：[method_audit_blind_spots.md](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/docs/audit_reports/method_audit_blind_spots.md)
