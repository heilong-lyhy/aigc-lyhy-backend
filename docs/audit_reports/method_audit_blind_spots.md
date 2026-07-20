# 方法体语义审计盲区分析报告

> 生成时间：2026-07-15
> 更新时间：2026-07-16
> 触发原因：首轮架构审计仅使用 import 级 grep + ESLint 扫描，遗漏了 6 类明确架构/契约偏差。本报告系统性梳理所有"平常不会检查但可能导致错误遗漏"的审计盲区，供后续全局检查计划参考。
> 2026-07-16 更新：Codex 二轮审计发现首轮修复后仍有 8 类遗漏，新增 B10–B14 盲区类别，并更新 B1/B3/B5/B6/B8 的遗漏分析。

---

## 一、盲区分类总览

| 编号 | 盲区类别 | 遗漏的问题 | 根本原因 | 检查方法 |
|------|---------|-----------|---------|---------|
| B1 | 运行时行为语义 | GraphQL Guard `info` 参数忽略；Filter 生产环境错误分类 | 只做 import 静态分析，未读方法体条件分支 | 逐方法体阅读 Guard/Filter 的 handleRequest/catch 逻辑 |
| B2 | 跨层类型隐式传播 | Usecase 持有 ORM Entity（通过 Service 返回值） | 只 grep `import *.entity`，未追踪方法返回值类型跨层传播 | 追踪 Service 公开方法返回类型是否为 Entity；Usecase 是否读取 Entity 字段 |
| B3 | 方法体内编排/决策 | Resolver 编排多 Usecase、做角色权限判断 | 只检查依赖方向，未分析单方法内调用数量和条件授权 | 统计 Resolver 方法内 Usecase 调用次数；检查 Resolver 内条件分支是否做授权/敏感输出决策 |
| B4 | 异常处理策略 | Resolver catch 后返回 `{ success: false }` 吞掉 DomainError | 无 grep 模式覆盖 `catch { return { success: false` | grep Resolver 中 `catch` + `return` 组合；检查是否绕过全局错误过滤器 |
| B5 | 架构决策一致性 | Capability bus/queue 遗留、reference.report Anchor 与决策冲突 | 未对照 `docs/capabilities/current.md` 和 `plans/README.md` 做决策偏离检查 | 对照决策文档逐一验证每个 Capability ID 是否有对应 Anchor；检查 queue-registry 是否注册了决策已废弃的队列 |
| B6 | types 层内容语义 | reflect-metadata 副作用、Ant Design Pro 响应类型、单流程类型、BullMQ 真源 | 只检查 types 是否 import core，未检查内容是否符合"稳定无框架契约"定义 | 检查 types 文件中是否有 `import` 运行时副作用；检查使用者是否跨域；检查是否承载 framework 常量 |
| B7 | 死代码/重复定义 | modules 层 WeAppProvider 死代码、双 ThirdPartyProvider 接口 | 未做 modules 层框架 import 检查；未做同域接口重复检测 | 检查 modules 层是否 import HttpService 等 infrastructure 框架；检查同域 interfaces/ vs contracts/ 重复定义 |
| B8 | 硬编码配置值 | 微信 API URL、timeout、Cravatar URL 硬编码 | 未 grep 硬编码 URL 和 magic number | grep infrastructure 层中的 URL 字面量和数值 timeout |
| B9 | 单测覆盖盲区 | GraphQL filter 单测未覆盖 401/403/400→INTERNAL_SERVER_ERROR 分支 | 未对照实现分支检查单测覆盖 | 对照 filter 实现的条件分支，检查单测是否覆盖每个分支 |
| B10 | Capability 运行时门控实效 | notification.email Anchor 已安装但入队/发送只检查 runtime.email-delivery，禁用 notification.email 无效 | 只检查 Anchor 是否声明，未追踪实际运行时 gate 是否检查正确的 CapabilityId | 追踪每个 Capability Anchor 对应的运行时 requireEnabled 调用，确认 gate 检查的 ID 与 Anchor 一致 |
| B11 | Usecase→Usecase 链式多跳 | LoginWithUserInfoUsecase→LoginWithPasswordUsecase→ExecuteLoginFlowUsecase（3 层）；第三方链达 4 层 | B3 只检查 Resolver→Usecase 编排，未追踪 Usecase→Usecase 调用链深度 | 递归追踪每个 Usecase 内的 Usecase 调用，计算调用链深度，≥2 层即违反 usecase.rules.md |
| B12 | modules(service) 业务决策与写语义 | AccountSecurityService.checkAndHandleAccountSecurity() 做暂停决策 + fire-and-forget 写入 | 只检查 modules 是否 import infrastructure，未检查 modules(service) 是否承担了本应由 Usecase 负责的业务决策和写编排 | 检查 modules(service) 的公开方法是否包含条件性写操作、业务决策逻辑或 fire-and-forget 异步写入 |
| B13 | 文档-代码漂移 | auth-session-current.md 仍写 LoginWithPasswordUsecase 为入口（实际已改为 LoginWithUserInfoUsecase）；account-write-current.md 仍写 success:false（代码已改为抛 GraphQL error） | 审计未包含文档-代码一致性检查规程 | 每次代码修改后对照对应的 `*-current.md` 文档验证入口路径、返回格式、错误分类是否一致 |
| B14 | 修复验证不完整 | B1 修复 Guard 后扔原始 Error 仍被 Filter 映射为 500；B5 删了 bus 但 envelope/handler 抽象仍大量使用；B8 硬编码 URL 仍未迁出；B6 field-encryption 常量仍残留 | 审计发现问题后只做局部修复，未沿因果链验证修复是否真正解决根因 | 修复后沿异常传播路径端到端验证；修复后检查相关抽象层是否还有残留；修复后 grep 确认硬编码值已消失 |

---

## 二、各盲区详细说明与检查规程

### B1：运行时行为语义

**遗漏场景**：
- Guard 的 `handleRequest(err, user, info)` 中，`info` 参数被忽略，导致无效 token（过期/签名错误）被当成匿名用户放行
- Filter 的 `isProdEnv ? 'INTERNAL_SERVER_ERROR' : mapHttpToGqlCode(status)` 在生产环境把 401/403/400 全部映射为 INTERNAL_SERVER_ERROR

**为什么 import 级 grep 检测不到**：
- 这些都是方法体内的条件分支逻辑，不涉及违规的 import 语句
- ESLint boundaries 插件只管依赖方向，不管运行时行为

**检查规程**：
1. 逐文件阅读 `src/adapters/api/graphql/guards/*.guard.ts`，确认 `handleRequest` 是否处理第三个参数 `info`
2. 逐文件阅读 `src/infrastructure/graphql/filters/*.filter.ts`，确认每个条件分支的错误分类是否符合全局契约
3. 对照 `docs/api/graphql-error-contract.md`（如存在）验证错误码映射

### B2：跨层类型隐式传播

**遗漏场景**：
- `AccountService.createAccountEntity()` 返回 `AccountEntity`，`saveAccount()` 返回 `AccountEntity`
- `CreateAccountUsecase` 持有 `savedAccount` 并读取 `savedAccount.id`、`savedAccount.createdAt`
- `VerificationRecordService.createRecord()` 返回 `VerificationRecordEntity`
- `CreateVerificationRecordUsecase` 将 Entity 交给 `QueryService.toDetailView()`

**为什么 import 级 grep 检测不到**：
- Usecase 没有 `import { AccountEntity }` 语句——Entity 类型通过 Service 方法返回值隐式传播
- ESLint 无法追踪 TypeScript 类型推断链

**检查规程**：
1. 扫描 `src/modules/**/*.service.ts` 的公开方法，列出返回类型为 `*Entity` 的方法
2. 扫描 `src/usecases/**/*.usecase.ts`，检查是否调用了上述方法并持有返回值
3. 检查 Usecase 是否读取了 Entity 的字段（如 `.id`、`.createdAt`）
4. 检查 QueryService 的 mapper 参数契约是否接受 Entity 类型

### B3：方法体内编排/决策

**遗漏场景**：
- `AuthResolver.login()` 依次调用 `loginWithPasswordUsecase` + `fetchUserInfoUsecase`——Resolver 编排了两个 Usecase
- `ThirdPartyAuthResolver.thirdPartyLogin()` 同样编排 login + fetchUserInfo
- `VerificationRecordResolver.createVerificationRecord()` 内做角色判断 + generatedByServer 判断，决定是否返回明文 token

**为什么 import 级 grep 检测不到**：
- Resolver 确实可以 import Usecase（依赖方向合法），问题在于一个方法内调用了几个 Usecase、是否有条件分支做授权决策

**检查规程**：
1. 扫描 `src/adapters/api/graphql/**/*.resolver.ts`，统计每个方法内的 Usecase 调用次数
2. 如果一个方法调用 ≥2 个 Usecase，标记为"Adapter 内编排违规"
3. 检查 Resolver 方法体内是否有条件分支做权限/敏感输出决策（如 `if (role === 'ADMIN')`、`canReturnToken`）
4. 对照 `docs/common/usecase.rules.md` 验证编排应归属 Usecase

### B4：异常处理策略

**遗漏场景**：
- `AccountResolver.resetPassword()` catch 后返回 `{ success: false, message: ... }`
- `VerificationRecordResolver.createVerificationRecord()` catch 后返回 `{ success: false, ... }`
- `VerificationRecordResolver.consumeVerificationRecord()` 同样 catch 吞 DomainError

**为什么 import 级 grep 检测不到**：
- 这是异常处理策略问题，不是 import/依赖方向问题
- 代码"看起来正常"（有 catch、有返回值），但绕过了全局 GraphQL 错误过滤器

**检查规程**：
1. grep `src/adapters/` 中所有 `catch` 块
2. 检查 catch 块内是否返回 `{ success: false` 或类似结构化响应
3. 确认是否应让 DomainError 冒泡到全局 Filter，而非在 Resolver 内吞掉
4. 对照全局错误契约验证 extensions.code 是否正确传递

### B5：架构决策一致性

**遗漏场景**：
- `src/usecases/common/ports/capability-bus.contract.ts` 保留完整的通用 Command/Query/Event Bus 抽象
- `src/infrastructure/bullmq/queue-registry.ts` 仍注册 CAPABILITY 队列
- `src/modules/reference/reference-report.capability.ts` 声明 reference.report Anchor，但决策说 report 只是 composition usecase

**为什么 import 级 grep 检测不到**：
- 这些代码没有违反任何 import 依赖方向规则
- 违规是与 Capability 治理决策/当前规则文档冲突，属于"架构决策偏离"

**检查规程**：
1. 阅读 `docs/capabilities/current.md`，列出所有已决策的 Capability ID
2. 扫描 `src/modules/**/*.capability.ts`，对照决策验证每个 Anchor 是否有对应决策
3. 扫描 `src/usecases/common/ports/capability-bus.contract.ts`，确认是否已废弃
4. 扫描 `src/infrastructure/bullmq/queue-registry.ts`，确认每个注册队列是否有对应决策
5. 阅读 `plans/README.md`，确认是否有对应治理计划

### B6：types 层内容语义

**遗漏场景**：
- `src/types/common/field-encryption.metadata.ts` 包含 `import 'reflect-metadata'` + `Reflect.getMetadata/defineMetadata`——types 层不应有运行时副作用
- `src/types/response.types.ts` 是 Ant Design Pro 风格响应，仅被 infrastructure middleware 使用
- `src/types/models/registration.types.ts` 仅服务单个注册流程
- `src/types/worker/bullmq.types.ts` 承载 BullMQ 队列名常量，与文档"infrastructure registry 是 runtime 真源"冲突

**为什么 import 级 grep 检测不到**：
- 只检查了 types 是否 import core（无违规），未检查 types 文件自身的内容语义

**检查规程**：
1. 扫描 `src/types/**/*.ts` 中的 `import` 语句，检查是否有运行时副作用（如 `import 'reflect-metadata'`）
2. 对每个 types 文件，grep 其在全项目的使用者数量和所属层，判断是否应 collocate
3. 检查 types 文件是否承载 framework-specific 常量（如 BullMQ queue 名、NestJS token）
4. 对照 `docs/common/type.rules.md` 验证四层类型模型归属

### B7：死代码/重复定义

**遗漏场景**：
- `src/modules/third-party-auth/providers/weapp.provider.ts` 在 modules 层直接使用 HttpService——属于 infrastructure 职责，且已有 WeAppHttpProvider 替代
- 同域内 `interfaces/third-party-provider.interface.ts` 和 `contracts/third-party-provider.contract.ts` 两个同名 ThirdPartyProvider 接口

**为什么 import 级 grep 检测不到**：
- modules 层 import HttpService 不违反 ESLint 依赖方向规则（modules 可依赖 @nestjs/*）
- 同域接口重复定义不是 import 方向问题

**检查规程**：
1. 扫描 `src/modules/**/*.ts` 中对 `HttpService`、`HttpModule` 的 import
2. 扫描每个业务域目录下的 `interfaces/` 和 `contracts/`，检查是否有同名接口/类型重复定义
3. 确认是否有 infrastructure 层的替代实现使 modules 层实现成为死代码

### B8：硬编码配置值

**遗漏场景**：
- `weapp-http.provider.ts` 硬编码 `'https://api.weixin.qq.com/sns/jscode2session'` 和 `timeout: 10000`
- `cravatar-avatar-generator.adapter.ts` 硬编码 `'https://cravatar.cn/avatar/'`

**为什么 import 级 grep 检测不到**：
- 硬编码 URL 和 magic number 不涉及 import 违规
- ESLint no-hardcoded-urls 规则（如果配置）可能捕获，但通常未启用

**检查规程**：
1. grep `src/infrastructure/**/*.ts` 中的 URL 字面量（`https?://`）
2. grep `src/infrastructure/**/*.ts` 中的数值 timeout（`timeout:\s*\d+`）
3. 对照项目非协商规则，确认是否应通过 ConfigService/options token 注入

### B9：单测覆盖盲区

**遗漏场景**：
- GraphQL exception filter 单测只覆盖了 DomainError(CAPABILITY_UNAVAILABLE)，未覆盖 HttpException 401/403/400→INTERNAL_SERVER_ERROR 分支

**为什么 import 级 grep 检测不到**：
- 单测覆盖是质量属性，不是架构依赖问题

**检查规程**：
1. 对照 `src/infrastructure/graphql/filters/*.filter.ts` 的条件分支，列出所有分支
2. 扫描对应 `*.spec.ts`，确认每个分支是否有测试用例
3. 对未覆盖的关键分支（尤其是错误分类相关），标记为单测盲区

### B10：Capability 运行时门控实效

**遗漏场景**：
- `notification.email` Anchor 已在 `email-capability.providers.ts` 安装，但 `EmailQueueService.enqueueSend()` 只检查 `runtime.email-delivery`，`EmailDeliveryService` 也只检查 `runtime.email-delivery`
- 禁用 `notification.email` 不会阻止任何入队或发送行为
- `notification.email.sendmail` 未注册进任何 Module，Worker 激活仍检查 `runtime.email-delivery`，与文档"禁用后不认领任务"不一致

**为什么 import 级 grep 检测不到**：
- B5 只检查了 Anchor 是否声明、queue-registry 是否有废弃队列
- 未追踪实际运行时 `requireEnabled()` 调用检查的是哪个 CapabilityId
- Anchor 存在不等于行为被正确门控

**检查规程**：
1. 对每个 switchable Capability Anchor，grep 其 `requireEnabled` 调用位置
2. 验证 `requireEnabled` 传入的 CapabilityId 是否与 Anchor 的 capabilityId 一致
3. 对父子 Capability 关系，验证子 Capability 的运行时行为是否受父 Capability 状态控制
4. 对照 `docs/capabilities/current.md` 验证每个 Capability 的行为描述与实际 gate 一致

### B11：Usecase→Usecase 链式多跳

**遗漏场景**：
- 密码链：`LoginWithUserInfoUsecase` → `LoginWithPasswordUsecase` → `ExecuteLoginFlowUsecase`（3 层）
- 第三方链：`LoginWithUserInfoUsecase` → `LoginWithThirdPartyUsecase` → `LoginByAccountIdUsecase` → `ExecuteLoginFlowUsecase`（4 层）
- 直接违反 `docs/common/usecase.rules.md:51` 的"仅允许一层、禁止 A→B→C"

**为什么 B3 没覆盖**：
- B3 只检查了 Resolver→Usecase 的编排数量
- 未将检查延伸至 Usecase→Usecase→Usecase 的调用链深度
- usecase.rules.md 明确禁止链式多跳，但审计规程未包含此检查

**检查规程**：
1. 扫描 `src/usecases/**/*.usecase.ts`，列出每个 Usecase 的构造函数中注入的其他 Usecase
2. 递归构建 Usecase 依赖图
3. 对每条调用路径，计算 Usecase→Usecase 的链式深度
4. 深度 ≥2 的链标记为违规，应按规则"新增上层 Usecase 统一编排，直接调用底层 service"

### B12：modules(service) 业务决策与写语义

**遗漏场景**：
- `AccountSecurityService.checkAndHandleAccountSecurity()` 是 modules(service) 层的公开方法
- 内部做业务决策（检测到不一致→决定暂停账户）
- 使用 fire-and-forget 方式执行 `suspendAccount()` 数据库更新
- 调用方（`LoginWithUserInfoUsecase` 和 `ExecuteLoginFlowUsecase`）无法等待写入完成、无法纳入事务
- 写失败仅记日志，不向上传播

**为什么 import 级 grep 检测不到**：
- B3/B4 只关注 Resolver 和 Usecase 层的编排/异常处理
- modules(service) 的 import 方向合法（可依赖 infrastructure/core）
- 问题在于 modules(service) 承担了本应由 Usecase 负责的业务决策和写编排语义

**检查规程**：
1. 扫描 `src/modules/**/*.service.ts`，检查公开方法是否包含条件性写操作
2. 检查是否有 fire-and-forget 异步写入（`.catch()` 不向上传播错误）
3. 验证写操作是否应提升到 Usecase 层编排
4. 对照 `docs/common/usecase.rules.md` 验证"写语义一律在 Usecase 内完成"

### B13：文档-代码漂移

**遗漏场景**：
- `docs/api/auth-session-current.md:24` 仍写 Usecase 入口为 `LoginWithPasswordUsecase`，实际入口已改为 `LoginWithUserInfoUsecase`
- `docs/api/account-write-current.md:110` 仍规定密码重置失败返回 `success:false`，当前代码已改为抛 GraphQL error
- `npm run capability:docs:check` 失败，生成文档缺少 `notification.email`

**为什么 import 级 grep 检测不到**：
- 前版审计完全没有文档-代码一致性检查规程
- 文档漂移是架构偏离的隐性载体——开发者以文档为准做决策时可能引入更多偏差

**检查规程**：
1. 每次代码修改后，grep 对应 `*-current.md` 文档中引用的类名/方法名是否仍存在于代码
2. 对照文档描述的返回格式与实际代码实现是否一致
3. 运行 `npm run capability:docs:check`（如有）确认文档与代码拓扑一致
4. 按 `rule-precedence.rules.md` 判断文档冲突时的优先级：专项契约在其范围内优先

### B14：修复验证不完整

**遗漏场景**：
- B1 修复了 Guard 的 `info` 参数，但扔出的原始 Error 被 Filter 的 `buildGraphQLErrorFromUnknown` 路径捕获，映射为 `INTERNAL_SERVER_ERROR`，仍未达到 `UNAUTHENTICATED` 契约
- B5 删除了通用 Capability bus contract，但 `capability.types.ts` 中的 Envelope/Handler/Operation 抽象仍大量残留并被实际使用；`capability.decorators.ts` 中的通用元数据注册器仍保留
- B8 标记了硬编码 URL，但修复后 `cravatar-avatar-generator.adapter.ts` 仍直接读 `process.env` 并保留硬编码 fallback URL；`weapp-http.provider.ts` 仍硬编码 API URL 和超时
- B6 标记了 field-encryption 的 reflect-metadata 副作用，但修复后残留未使用的运行时 metadata 常量，且与 infrastructure 定义重复

**根本原因**：
- 审计发现问题后只做了局部修复，未沿因果链端到端验证修复效果
- 例如：修复 Guard 扔 Error→未验证 Filter 如何处理非 HttpException 非 DomainError 的原始 Error
- 例如：删除 bus contract→未检查 capability.types.ts 中是否还有通用 envelope/handler 抽象被使用
- 例如：标记硬编码→未验证修复后 grep 确认硬编码值已消失

**检查规程**：
1. 修复后沿异常传播路径端到端验证：从 Guard 抛出→Filter 接收→最终 GraphQL 响应
2. 修复后检查相关抽象层是否还有残留使用：grep 被删除抽象的消费者
3. 修复后 grep 确认硬编码值已消失：`grep -rn "https\?://" src/infrastructure/` 应返回空
4. 对每个修复项，写一个"验证条件"，修复完成时必须确认验证条件通过

---

## 三、审计策略修正建议

### 原策略（仅 import 级）

```
ESLint boundaries + grep import 方向 → 仅覆盖分层依赖方向
```

### 修正后策略（import 级 + 方法体语义级 + 因果链验证级）

```
Step 1: ESLint boundaries + grep import 方向（分层依赖方向）
Step 2: 方法返回类型追踪（跨层类型隐式传播，B2）
Step 3: Guard/Filter 条件分支审查 + 异常传播端到端验证（运行时行为语义，B1 + B14）
Step 4: Resolver 方法体编排/授权审查（B3 + B4）
Step 5: Usecase→Usecase 调用链深度追踪（B11）
Step 6: modules(service) 业务决策/写语义审查（B12）
Step 7: Capability 运行时门控实效验证（B10）
Step 8: 架构决策一致性对照（B5）+ 通用抽象残留检查
Step 9: types 层内容语义审查（B6）
Step 10: 死代码/重复定义/硬编码扫描 + 修复后验证（B7 + B8 + B14）
Step 11: 文档-代码一致性检查（B13）
Step 12: 单测覆盖盲区检查（B9）
Step 13: 修复验证——沿因果链端到端确认每个修复项（B14）
```

---

## 四、检查命令速查表

| 盲区 | 检查命令/方法 |
|------|-------------|
| B1 | 逐文件阅读 `src/adapters/api/graphql/guards/*.guard.ts` + `src/infrastructure/graphql/filters/*.filter.ts` 的条件分支 |
| B2 | `grep -rn "Promise<.*Entity>" src/modules/` + 追踪 Usecase 调用链 |
| B3 | 统计 Resolver 方法内 `this.*Usecase.execute` 调用次数；grep 条件授权模式 |
| B4 | `grep -rn "catch.*{.*return.*success.*false" src/adapters/` |
| B5 | 对照 `docs/capabilities/current.md` 逐一验证 |
| B6 | `grep -rn "import '" src/types/`（副作用导入）；逐文件检查使用者范围 |
| B7 | `grep -rn "HttpService" src/modules/`；同域 interfaces/ vs contracts/ 对比 |
| B8 | `grep -rn "https\?://" src/infrastructure/` + `grep -rn "timeout:" src/infrastructure/` |
| B9 | 对照实现分支检查 `*.spec.ts` 覆盖 |
| B10 | 对每个 switchable Capability，grep `requireEnabled` 确认 gate ID 与 Anchor 一致 |
| B11 | 递归追踪 `src/usecases/**/*.usecase.ts` 构造函数注入的 Usecase 依赖，计算链深度 |
| B12 | grep `src/modules/**/*.service.ts` 中的 fire-and-forget（`.catch(` 无 rethrow）和条件性写操作 |
| B13 | 对每个 `*-current.md`，grep 文档中引用的类名/方法名是否仍存在于代码 |
| B14 | 修复后沿异常传播路径端到端验证；grep 确认残留/硬编码已消失 |
| B15 | 修复表面化——只改了入口路径，未删除违规实现 + 未追踪完整因果链 | 5 项"已修复"问题被 Codex 证实未真正修复：(1) sendmail Anchor 未注册到 Module；(2) 旧多跳 Usecase 仍注册为生产 provider；(3) shouldSuspend 只抛错误未写库；(4) 硬编码默认值仍留在执行类；(5) Gravatar adapter 仍读 process.env | 修复时只关注"新入口是否绕开问题"，未验证"旧违规路径是否仍可达"；修复时只改了最明显的症状，未追踪问题是否在整个因果链上被彻底消除 | 修复后必须：(1) grep 确认旧违规实现无生产调用者后删除；(2) 验证修复不仅解决表面症状，还沿因果链确认根因被消除；(3) 检查是否遗漏了同族问题（如注册了父 Capability gate 但子 Capability Anchor 仍未注册） |
| B16 | 常量声明未与 Anchor/Provider 注册集合做差集核对 | 常量已声明但无对应 Anchor/Provider 注册：`email-capability.constants.ts` 声明 `NOTIFICATION_EMAIL_SENDMAIL_CAPABILITY_ID = 'notification.email.sendmail'`，但 `email-capability.providers.ts` 仅注册 `NotificationEmailCapabilityAnchor` 和 `RuntimeEmailDeliveryCapabilityAnchor`，缺 sendmail 子 Capability 的 Anchor | AI 审计时将"声明常量"等价于"已实现 Anchor"，未做"常量集合 vs 注册 Anchor 集合"的差集扫描；只检查 Anchor 是否存在，未检查每个 capabilityId 常量是否都有对应 Anchor | 扫描 `*.constants.ts` 中所有 `*_CAPABILITY_ID` 常量，与 `@CapabilityAnchorProvider` 装饰器的 `capabilityId` 入参做集合差集，差集元素即为"声明未注册"的盲点 |
| B17 | "配置缺失兜底默认值"被忽略为可接受的硬编码 | `blog-storage.module.ts` factory 中 `configService.get('CRAVATAR_BASE_URL') ?? 'https://cravatar.cn/avatar'`、`third-party-auth-infrastructure.module.ts` 中 `?? 'https://api.weixin.qq.com'` 和 `?? 10000` | B8 只检查"是否硬编码 URL/magic number"，未区分"硬编码主路径" vs "配置缺失兜底"——后者仍属于硬编码，应通过启动期校验在配置缺失时报错而非静默用 fallback | 扫描所有 `useFactory` 中的 `?? '...'`、`|| '...'`、`?? <number>` 默认值，对照非协商规则判断该配置项是否应强制由环境变量提供；若应强制，则需在启动期校验函数中加 `assertEnv` 而非在 factory 中静默兜底 |

---

## 五、B15 5 项问题二次核查结果（2026-07-20）

对 Codex 在 B15 中提到的 5 项问题做逐项源码核查：

| # | Codex 描述 | 实际核查结果 | 是否成立 |
|---|-----------|-------------|---------|
| 1 | sendmail Anchor 未注册到 Module | **初次核查误判为成立，后修正为不成立**：sendmail Anchor 实际上已通过 `src/modules/common/email-worker/email-sendmail.capability.ts` 中的 `EmailSendmailCapabilityBinding` 类（带 `@CapabilityAnchorProvider` 装饰器）注册，并由 `EmailWorkerModule`（仅 worker 进程）加载。生成文档 `docs/generated/capabilities-current.md` 第 9 行也证实 `notification.email.sendmail` 的 entry module 是 `EmailWorkerModule`，processes 为 `worker`。初次核查仅看了 `email-capability.providers.ts` 和 `email-capability.module.ts`，未追踪到 `email-worker/` 目录下的独立 Anchor 注册，导致误判 | **不成立（已修复，初次核查有误）** |
| 2 | 旧多跳 Usecase 仍注册为生产 provider | `auth-usecases.module.ts` 仅注册 `ExecuteLoginFlowUsecase`/`LoginWithUserInfoUsecase`/`DecideLoginRoleUsecase`/`EnrichLoginWithIdentityUsecase`/`ValidateAccessTokenSessionUsecase`/`LogoutUsecase`/`RefreshAccessTokenUsecase`；Glob 未发现 `login-with-password.usecase.ts`/`login-with-third-party.usecase.ts`/`login-by-account-id.usecase.ts`；Grep 证实代码中无对旧 Usecase 的引用（仅文档/计划中残留） | **不成立（已修复）** |
| 3 | shouldSuspend 只抛错误未写库 | `execute-login-flow.usecase.ts:103-111` 在 `shouldSuspend === true` 时先 `await this.accountSecurityService.suspendAccount(...)` 持久化，再 `throw DomainError(ACCOUNT_SUSPENDED)`；`login-with-user-info.usecase.ts:249-254` 同样先 `await suspendAccount(...)` 再抛错。代码注释明确说明"先持久化暂停状态，再抛出领域错误"，并解释了 suspendAccount 持久化失败时优先抛 `ACCOUNT_SUSPEND_FAILED` 的语义 | **不成立（已修复）** |
| 4 | 硬编码默认值仍留在执行类 | `weapp-http.provider.ts` 自身已无硬编码（`apiBaseUrl`/`requestTimeout` 通过 `@Inject(WEAPP_PROVIDER_OPTIONS)` 注入）；`cravatar-avatar-generator.adapter.ts` 已不读 `process.env`（通过 `@Inject(CRAVATAR_BASE_URL_TOKEN)` 注入）；但 `blog-storage.module.ts` 和 `third-party-auth-infrastructure.module.ts` 的 `useFactory` 中保留了 fallback 默认值（`?? 'https://cravatar.cn/avatar'`、`?? 'https://api.weixin.qq.com'`、`?? 10000`） | **部分成立**（仅 module factory 的 fallback 默认值，执行类已干净）→ **已修复**：fallback 已上提到 `config.module.ts` 的 `blogExternalConfig` 和 `thirdPartyAuthConfig`，module factory 改为从 ConfigService 读取已注册配置 |
| 5 | Gravatar adapter 仍读 process.env | `cravatar-avatar-generator.adapter.ts` 已彻底不读 `process.env`，仅通过 DI 注入 `CRAVATAR_BASE_URL_TOKEN`；`process.env.CRAVATAR_BASE_URL` 的读取已下沉到 `blog-storage.module.ts` 的 `useFactory` 中通过 `ConfigService` 完成，且 adapter 类已重命名为 `CravatarAvatarGeneratorAdapter`（不再是 Gravatar） | **不成立（已修复）** |

**核查结论（修正后）**：5 项中 1 项部分成立（#4，已修复）、4 项已在之前修复中彻底解决（含初次核查有误的 #1）。

### B15 5 项问题为什么 AI 助手未能检查出这些问题？

#### 1. sendmail Anchor 未注册（初次核查误判，B16 撤销）

**初次核查误判原因**：
- 初次仅查看 `email-capability.providers.ts` 和 `email-capability.module.ts`，未追踪到 `email-worker/` 目录下的独立 Anchor 注册
- 项目存在"Capability Anchor 分散注册"模式：父 Capability（`notification.email`、`runtime.email-delivery`）在 `email-capability` 模块，子 Capability（`notification.email.sendmail`）在 `email-worker` 模块——这种分离注册符合"子 Capability 仅在 worker 进程生效"的语义，但增加了审计追溯难度
- 修复时尝试在 `email-capability.providers.ts` 重复注册 `NotificationEmailSendmailCapabilityAnchor`，结果 `npm run capability:docs:check` 报错 `Capability anchor differs across processes: notification.email.sendmail`——因为 api 进程也加载了 EmailCapabilityModule，导致 Anchor 在 api+worker 进程间 requires 字段不一致

**实际状态**：sendmail Anchor 已通过 `EmailSendmailCapabilityBinding`（带 `@CapabilityAnchorProvider` + `@CapabilityRuntimeContributionProvider` 双装饰器）注册到 `EmailWorkerModule`，仅在 worker 进程生效，符合"sendmail provider 仅在 worker 进程领取任务"的契约

**根本原因（撤销 B16）**：B16 提出的"常量声明未与 Anchor 注册集合做差集核对"本身是合理盲点，但本案例不构成 B16 违规——常量已有对应 Anchor，只是 Anchor 分散在不同模块中。真正的盲点是"未做全项目 Anchor 装饰器扫描"，而非"未做差集核对"

#### 2. 旧多跳 Usecase 仍注册为生产 provider

**为何未检出（其实已修复，但 Codex 报告时仍按未修复描述）**：
- 此项实际已修复——`auth-usecases.module.ts` 已不再注册旧 Usecase，旧文件已删除
- Codex 报告可能是基于较早版本代码或文档（`docs/audit_reports/method_audit_blind_spots.md` B11 中提到的旧 Usecase 名称）生成
- AI 助手在多轮检查中确认了此项已修复（参见 `LoginWithUserInfoUsecase` 已扁平化为 1 跳调用 `ExecuteLoginFlowUsecase`/`DecideLoginRoleUsecase`/`EnrichLoginWithIdentityUsecase`）

**根本原因**：Codex 与 AI 助手对"代码当前状态"的认知存在版本差，Codex 报告可能未反映最新修复

#### 3. shouldSuspend 只抛错误未写库

**为何未检出（实际已修复）**：
- 此项实际已修复——`execute-login-flow.usecase.ts:107-111` 和 `login-with-user-info.usecase.ts:250-254` 都先 `await suspendAccount(...)` 再抛错
- AI 助手在多轮检查中确认了此项已修复，且代码注释明确解释了"先持久化再抛错"的语义和失败优先级

**根本原因**：同 #2，Codex 报告基于较早版本代码生成

#### 4. 硬编码默认值仍留在执行类（B17 部分成立，已修复）

**为何未检出**：
- B8 只检查"是否硬编码 URL/magic number"，且只关注执行类（service/provider/adapter）内部
- 没有覆盖"module factory 中的 `?? '默认值'` 兜底"——这属于"配置缺失兜底"，本质上仍是硬编码，但因符合"约定优于配置"的常见模式而被忽略
- 修复方案：将 fallback 默认值上提到 `config.module.ts` 的 `blogExternalConfig`（Cravatar）和 `thirdPartyAuthConfig`（微信 API）configFactory，与其他配置项（jwtConfig、blogStorageConfig 等）统一管理；module factory 改为从 ConfigService 读取已注册的配置命名空间

**根本原因**：审计规程对"硬编码"的界定不够严格，未将"配置缺失兜底默认值"纳入硬编码扫描范围；同时项目缺少"所有 fallback 默认值必须集中在 config.module.ts"的明确约定

#### 5. Gravatar adapter 仍读 process.env

**为何未检出（实际已修复）**：
- 此项实际已修复——adapter 已重命名为 `CravatarAvatarGeneratorAdapter`，已彻底不读 `process.env`，改为通过 DI 注入 `CRAVATAR_BASE_URL_TOKEN`
- `process.env` 的读取已下沉到 `blog-storage.module.ts` 的 `useFactory` 中通过 `ConfigService` 完成，符合"运行时配置读取只能在 infrastructure module 的 DI wiring 中"的非协商规则
- Codex 报告可能基于较早版本代码（仍叫 GravatarAvatarGeneratorAdapter）

**根本原因**：同 #2、#3，Codex 报告基于较早版本代码生成

### 经验教训

1. **Capability Anchor 分散注册模式**：子 Capability 可能与其父 Capability 分散在不同模块中（如 `notification.email` 在 `email-capability`，`notification.email.sendmail` 在 `email-worker`），审计必须做"全项目 `@CapabilityAnchorProvider` 装饰器扫描"，不能只查单一模块。
2. **硬编码的边界**：硬编码不只包括"执行类内部的字面量"，也包括"module factory 中的 `?? 'fallback'` 兜底默认值"——后者在配置缺失时静默使用，可能掩盖配置错误。严格审计应通过启动期 `assertEnv` 校验。
3. **多版本对齐**：当 Codex/AI 报告与当前代码状态不一致时，必须以源码 grep 为唯一事实来源，而非依赖任一方的历史报告。
4. **修复验证必须沿因果链端到端**：B14、B15 的核心教训——修复后必须沿"声明 → 注册 → 调用 → 行为"四段链路端到端验证，而非只验证最末端行为。
5. **运行 lint 即可发现 Capability 注册冲突**：本项目 `npm run lint` 内置 `capability:docs:check`，会校验 Anchor 跨进程一致性。修复 Capability 相关问题时必须先跑 lint 验证，而非只看单元测试。
