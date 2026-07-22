# 遗留问题清单 - 2026-07-22（全局架构检查增量）

> 本文件记录 2026-07-22 执行 `plans/check/global-architecture-check.md` 全局检查中新发现但未直接修复的问题。
> 标记说明：[未解决] / [已解决]
> 上下文：本次全局检查复核 B1–B14 盲区，确认此前的修复（B1/B2/B3/B4/B5/B7-接口/B8/B9/B10/B11/B12/B13）均已生效，仅余以下两项新增发现。

---

## 1. `src/infrastructure/config/jwt.config.ts` 为未加载的重复死代码

- **状态**：[已解决 2026-07-22]
- **规范依据**：`docs/common/modules.rules.md` — 避免同一逻辑的二次实现；`docs/audit_reports/method_audit_blind_spots.md` B7（重复实现/死代码）
- **现状**：
  - 项目中存在**两处** `registerAs('jwt', ...)` 定义，字段、fallback 值与 `process.env.*` 读取完全相同：
    1. [config.module.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/infrastructure/config/config.module.ts) 第 499–518 行的内联 `jwtConfig` —— **实际加载**，已在 `ConfigModule.forRoot({ load: [..., jwtConfig, ...] })`（第 549 行附近）中注册。
    2. [jwt.config.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/infrastructure/config/jwt.config.ts) 第 1–32 行 —— 独立文件，导出 `default registerAs('jwt', ...)`。
  - 全仓库检索 `from '...jwt.config'` / `require(...jwt.config)` 均无匹配，即 `jwt.config.ts` **未被任何模块导入**，属孤立死代码。
  - 两份实现的 `expiresIn`/`refreshExpiresIn`/`algorithm`/`enableRefresh`/`issuer`/`audience` 默认值完全一致，是同源的复制粘贴。
- **影响**：
  - 死代码：`jwt.config.ts` 不参与运行时配置，仅增加阅读误导（误以为它是 JWT 配置的来源）。
  - 漂移风险：未来若有人按"独立 config 文件"惯例去 `jwt.config.ts` 改 JWT 默认值，将发现改动不生效，且与 `config.module.ts` 内联实现产生两份口径。
- **修复方案**：采用方案 A —— 直接删除 `src/infrastructure/config/jwt.config.ts`。JWT 配置由 `config.module.ts` 的 `jwtConfig` 单一来源提供，删除后不影响 `ConfigModule.forRoot` 的 `load` 列表（它引用的是内联 `jwtConfig`，不是该文件）。
- **涉及文件**：
  - `src/infrastructure/config/jwt.config.ts` — 已删除
- **风险**：极低。该文件无引用，删除不影响构建/测试/运行时。
- **验证**：
  - 删除前确认无引用：`grep -rn "jwt.config" src/ --include="*.ts"` 无匹配。
  - 删除后 `npm run typecheck` 通过（exit 0）。
  - 删除后 `npx eslint` 相关文件无报错。
  - 相关单测 `npx jest --testPathPatterns="(auth|jwt)"` 全通过。

---

## 2. `mapUserInfoViewToSecureDTO` / `serializeGeographic` 在两个 Resolver 中重复实现

- **状态**：[已解决 2026-07-22]
- **规范依据**：`docs/common/adapter.rules.md` — adapter 间不得复制粘贴同一映射逻辑；`docs/audit_reports/method_audit_blind_spots.md` B7（重复实现）
- **现状**：
  - 以下两个 private 方法在两个 Resolver 中**逐字重复**（仅注释措辞略有差异，逻辑完全相同）：
    - `mapUserInfoViewToSecureDTO(userInfoView: UserInfoView): UserInfoDTO` —— 将 `UserInfoView` 映射为安全 `UserInfoDTO`（移除 `metaDigest` 等敏感字段，约 30 行）。
    - `serializeGeographic(geographic: GeographicInfo | null): string | null` —— 将 `GeographicInfo` 序列化为 `"province, city"` 字符串（约 7 行）。
  - 重复位置：
    1. [auth.resolver.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/adapters/api/graphql/auth/auth.resolver.ts) 第 46–91 行（`login` mutation 使用）
    2. [third-party-auth.resolver.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/adapters/api/graphql/third-party-auth/third-party-auth.resolver.ts) 第 207–258 行（`thirdPartyLogin` mutation 使用）
  - 两处映射目标一致：把 `LoginWithUserInfoUsecase` 返回的 `userInfoView` 转成 GraphQL `UserInfoDTO`，保证 `metaDigest` 不外泄。
- **影响**：
  - 维护不同步风险：若 `UserInfoDTO` 字段调整或脱敏规则变化，需同步改两处，易遗漏。
  - 违反"单一实现"原则；属 adapter 层内的轻量重复，但因为是安全相关的脱敏映射，重复的代价高于普通工具函数。
  - 不涉及跨层违规：两处都在 adapter 层内，依赖关系正常。
- **修复方案**：发现 adapter 层已存在共享 mapper [user-info.mapper.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/adapters/api/graphql/account/dto/user-info.mapper.ts)，导出 `mapUserInfoViewToDTO`（与 `mapUserInfoViewToSecureDTO` 逻辑完全一致）和 `serializeGeographic`。但两个 Resolver 此前未使用它，仍保留私有副本。
  - 修复方式：让两个 Resolver 改为 `import { mapUserInfoViewToDTO } from '...user-info.mapper'`，删除各自的 private `mapUserInfoViewToSecureDTO` 与 `serializeGeographic`。
  - 同时清理因方法删除而不再使用的 import：`UserInfoView`、`GeographicInfo`、`UserInfoDTO`（在 auth.resolver 中）、`UserInfoDTO`（在 third-party-auth.resolver 中）。
  - mapper 留在 adapter 层（输出 `UserInfoDTO` 是 GraphQL DTO，不可下沉到 types/usecase/modules/core，符合 `docs/common/type.rules.md` L4 规则）。
- **涉及文件**：
  - [auth.resolver.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/adapters/api/graphql/auth/auth.resolver.ts) — 删除两个 private 方法，改用 mapper，清理 import
  - [third-party-auth.resolver.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/adapters/api/graphql/third-party-auth/third-party-auth.resolver.ts) — 删除两个 private 方法，改用 mapper，清理 import
  - [user-info.mapper.ts](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/src/adapters/api/graphql/account/dto/user-info.mapper.ts) — 原本未被使用，现已激活
- **风险**：极低。纯映射函数迁移，无副作用、无状态。
- **验证**：
  - `npm run typecheck` 通过（exit 0）。
  - `npx eslint` 三个相关文件（auth.resolver.ts、third-party-auth.resolver.ts、user-info.mapper.ts）均无报错。
  - `npx jest --testPathPatterns="(auth|third-party-auth|user-info)"` 4 个测试套件 / 56 个用例全通过。
  - 确认重复消除：`grep -rn "mapUserInfoViewToSecureDTO\|serializeGeographic" src/adapters/` 仅剩 mapper 文件定义，两个 Resolver 已无 private 副本。

---

## 本次全局检查已确认修复项（供对照）

> 以下 B1–B14 盲区在 2026-07-13 ~ 2026-07-22 的多轮 review 中已修复，本次全局检查复核确认仍生效。

| 盲区 | 结论 | 关键证据 |
|------|------|---------|
| B1 运行时行为语义 | ✅ 已修复 | `jwt-auth.guard.ts` 的 `handleRequest` 处理 `info` 区分 `TokenExpiredError`；`graphql-exception.filter.ts` 的 `mapHttpToGqlCode` 将 401→UNAUTHENTICATED、403→FORBIDDEN，与生产环境无关 |
| B2 跨层类型隐式传播（用例持有 Entity） | ✅ 已修复 | `AccountQueryService` 公开方法返回 `UserInfoView`/`AccountCredentialSnapshot`/`AccountLoginBootstrapSnapshot` 等 View/Snapshot，非 ORM Entity |
| B3 Resolver 内编排 | ✅ 已修复 | `AuthResolver.login` / `ThirdPartyAuthResolver.thirdPartyLogin` 均只调单一 `LoginWithUserInfoUsecase`，无多 usecase 编排 |
| B4 异常处理策略 | ✅ 已修复 | Resolver 不再 `catch DomainError` 返回 `success:false`，异常上浮至 `GqlAllExceptionsFilter` |
| B5 capability bus 残留 / reference.report anchor | ✅ 已修复 | `src/usecases/common/ports/` 仅余 `reference-profile-client.contract.ts` + `transaction-runner.contract.ts`；`capability-bus.contract.ts` 已删除；`reference` 模块仅 `reference-profile.capability.ts` |
| B6 types 层纯洁性 | ✅ 已修复 | `src/types/` 无 `core`/框架导入；历史 `field-encryption`/`bullmq.types`/`response.types`/`registration.types` 等已清理 |
| B7 重复接口定义 / modules 内 HttpService / WeAppProvider 死代码 | ✅ 已修复 | `ThirdPartyProvider` 仅 `contracts/third-party-provider.contract.ts` 一份定义；`src/modules` 内无 `HttpService`/`HttpModule` 引用；WeApp provider 已下沉至 `src/infrastructure/third-party-auth/providers/` |
| B8 硬编码 URL/超时 | ✅ 已修复 | `src/infrastructure` 内 `https?://` 仅余 `config.module.ts` 的 `getOptionalEnv ?? 'https://...'` 集中 fallback 与 spec 测试 mock；`timeout:\s*\d+` 无匹配；adapter 不再直读 `process.env` |
| B9 事务边界 | ✅ 已修复 | 所有写 usecase 通过 `TransactionRunner`（usecase 层 contract）开启事务，无 usecase 直调 `.save()/.insert()/.update()` |
| B10 capability 运行时门控有效性 | ✅ 已修复 | `EmailQueueService.enqueueSend` 同时 `requireEnabled(NOTIFICATION_EMAIL_CAPABILITY_ID)` 与 `requireEnabled(RUNTIME_EMAIL_DELIVERY_CAPABILITY_ID)`，禁用通知门控可阻断入队 |
| B11 Usecase→Usecase 多跳链 | ✅ 已修复 | `LoginWithUserInfoUsecase` 扁平编排，直接调底层 service 与同级 usecase，链路收敛为 1 hop |
| B12 Modules 业务决策与写语义 | ✅ 已修复 | `AccountSecurityService.validateAccessGroupConsistency` 为纯方法（返回 `{isValid, realAccessGroup, shouldSuspend}`，不写库）；`suspendAccount` 为粒度写方法且由 usecase `await` 完成后才抛错 |
| B13 文档-代码漂移 | ✅ 已修复 | `auth-session-current.md` 指明 `LoginWithUserInfoUsecase`、失败走 GraphQL error contract；`account-write-current.md` 明确 `resetPassword` 失败抛 GraphQL error、不再返回 `success:false` |
| B14 修复验证 | ✅ 已修复 | cravatar/weapp 的 URL 与超时已集中到 `config.module.ts`，adapter 不再直读 `process.env` |

## 关联

- 触发检查计划：[global-architecture-check.md](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/plans/check/global-architecture-check.md)
- 盲区定义：[method_audit_blind_spots.md](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/docs/audit_reports/method_audit_blind_spots.md)
- 同日其他问题：[question26-07-22.md](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/plans/Lingeringissue/question26-07-22.md)（capability npm scripts 漂移，已解决）
- 历史 question26-07-13 第 1 项（`runtime.async-task` 字面量）已采用方案 C 修复：`RUNTIME_ASYNC_TASK_CAPABILITY_ID` 已迁移至 `@app-types/common/capability-id.types`
- 历史 question26-07-13 第 2 项（`maskEmail` 重复）已修复：`maskEmail` 已抽取至 `@src/core/common/text/text.helper`
