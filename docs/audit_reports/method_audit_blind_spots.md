# 方法体语义审计盲区分析报告

> 生成时间：2026-07-15
> 触发原因：首轮架构审计仅使用 import 级 grep + ESLint 扫描，遗漏了 6 类明确架构/契约偏差。本报告系统性梳理所有"平常不会检查但可能导致错误遗漏"的审计盲区，供后续全局检查计划参考。

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

---

## 三、审计策略修正建议

### 原策略（仅 import 级）

```
ESLint boundaries + grep import 方向 → 仅覆盖分层依赖方向
```

### 修正后策略（import 级 + 方法体语义级）

```
Step 1: ESLint boundaries + grep import 方向（分层依赖方向）
Step 2: 方法返回类型追踪（跨层类型隐式传播，B2）
Step 3: Guard/Filter 条件分支审查（运行时行为语义，B1）
Step 4: Resolver 方法体编排/授权审查（B3 + B4）
Step 5: 架构决策一致性对照（B5）
Step 6: types 层内容语义审查（B6）
Step 7: 死代码/重复定义/硬编码扫描（B7 + B8）
Step 8: 单测覆盖盲区检查（B9）
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
