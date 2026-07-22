# 框架回退规划：1.6.1 → 1.3.0 - 2026-07-20

> 本文档原为**回退操作规划书**。
> **更新日志**：2026-07-22 已执行**策略一**（最小回退），全部验证通过。策略二、三仍为规划。
> 标记说明：[待执行] / [执行中] / [已完成] / [已跳过]

---

## 一、背景

### 1.1 回退动机

- 当前项目框架版本 1.6.1（package.json version）
- 1.6.1 引入的 Capability 自定义架构模式与国产 AI 适配性不佳
- 国产 AI 训练数据里没有 Capability 这种自定义装饰器/规则，生成代码时容易出错
- 希望退回到 1.3.0 的简单架构（无 Capability 系统），让 AI 更容易生成符合规范的代码

### 1.2 关键事实（决策前提）

| 事实 | 说明 |
|---|---|
| 老师 v1.3.0 → v1.6.1 **package.json 依赖完全没变** | 仅 `package-lock.json` 改了 4 行，`dependencies/devDependencies` 一字未动 |
| 真正变化的是 **Capability 系统 + lint 增强 + worker activation 模式** | 186 个文件改动，+6814 / -1593 行 |
| 用户项目业务代码已深度融合 Capability | 34 个 capability 文件，16 个用 `@CapabilityAnchorProvider`，25 个引用 `CapabilityModule/CapabilityRuntime/CapabilityGraph` |
| 用户项目自己额外加的依赖（非老师模板升级） | `@nestjs/throttler`、`graphql-upload`、`sanitize-html`、`@types/node` 25→26、`@nestjs/common` 11.1.22→11.1.27 |
| NestJS 一直是 11.x | 从 v1.2.0（项目初始化）到 v1.6.1，NestJS 从未变过主版本，仅 patch 升级 |

### 1.3 关键参考路径

- 老师模板项目（v1.3.0 baseline）：`~/aigc-template/aigc-friendly-backend/`，commit `fc25369`
- 老师模板项目（v1.6.1 当前）：`~/aigc-template/aigc-friendly-backend/`，commit `dba1a49`（HEAD）
- 本项目根目录：`/home/heilong_lyhy/aigc/aigc-friendly-backend/`
- 完整 diff stat 已缓存：`/tmp/v1.3-to-v1.6.1-diff.txt`

---

## 二、老师 v1.3.0 → v1.6.1 完整变更分类（186 文件）

### 2.1 类别 A：Capability 系统核心（必须完整回退或完整保留）

**新增文件（删除即可回退）：**

| 文件 | 行数 | 说明 |
|---|---|---|
| `src/infrastructure/capability/capability-bootstrap-check.ts` | 23 | 启动期校验 |
| `src/infrastructure/capability/capability-graph.spec.ts` | 104 | 图结构测试 |
| `src/infrastructure/capability/capability-graph.ts` | 283 | 依赖图 |
| `src/infrastructure/capability/capability-process-projection.spec.ts` | 85 | 进程投影测试 |
| `src/infrastructure/capability/capability-process-projection.ts` | 126 | 进程投影 |
| `src/infrastructure/capability/capability-runtime.spec.ts` | 142 | 运行时测试 |
| `src/infrastructure/capability/capability-runtime.ts` | 199 | 运行时核心 |
| `src/infrastructure/capability/capability.module.ts` | 32 | 模块定义 |
| `src/infrastructure/capability/capability.registry.ts` | 92 | 注册表 |
| `src/infrastructure/capability/config-capability-state.reader.spec.ts` | 64 | 状态读取测试 |
| `src/infrastructure/capability/config-capability-state.reader.ts` | 74 | 状态读取 |
| `scripts/capability-list.ts` | 393 | CLI 工具 |
| `src/types/common/capability.types.ts` | 49 | 类型定义 |
| `docs/common/capability.rules.md` | 179 | 规范文档 |
| `docs/common/capability-plugin.rules.md` | 10 | 插件规范 |
| `docs/common/capability-boundary-examples.md` | 52 | 边界示例 |
| `docs/common/capability-plugin-authoring.guide.md` | 66 | 开发指南 |
| `docs/capabilities/current.md` | 53 | 当前能力清单 |
| `docs/generated/capabilities-current.md` | 17 | 自动生成清单 |
| `docs/deprecated/capability-plugin-plan.md` | 664 | 已弃用规划 |
| `test/support/capability/capability-state-reader.fixture.ts` | 37 | 测试 fixture |

**修改文件（需对照 v1.3.0 恢复）：**

| 文件 | 变化 | 说明 |
|---|---|---|
| `src/infrastructure/capability/capability.decorators.ts` | +25 | 装饰器定义 |
| `src/types/common/capability.types.ts` | +49 | 类型定义 |
| `src/bootstraps/api/api.module.ts` | +2 | 引入 CapabilityModule |
| `src/bootstraps/worker/worker.module.ts` | +4 | 引入 CapabilityModule |
| `src/infrastructure/config/config.module.ts` | +14 | capability 配置 |

**各业务模块新增的 `*.capability.ts` 文件（21 个）：**

```
src/modules/account/account.capability.ts
src/modules/auth/auth.capability.ts
src/modules/third-party-auth/third-party-auth.capability.ts
src/modules/verification-record/verification-record.capability.ts
src/modules/async-task-record/async-task-record.capability.ts
src/modules/ai-workflow-context/ai-workflow.capability.ts
src/modules/common/ai-capability/ai-capability.constants.ts
src/modules/common/ai-capability/ai-capability.module.ts
src/modules/common/ai-capability/ai-capability.providers.ts
src/modules/common/email-capability/email-capability.constants.ts
src/modules/common/email-capability/email-capability.module.ts
src/modules/common/email-capability/email-capability.providers.ts
src/modules/common/capability-state-reader.contract.ts
src/modules/ai-workflow-context/ai-workflow-capability.gate.ts
src/modules/ai-workflow-context/queue/ai-workflow-queue.constants.ts
src/modules/ai-workflow-context/queue/ai-workflow-queue.module.ts
src/modules/ai-workflow-context/queue/ai-workflow-queue.service.ts
src/modules/ai-workflow-context/queue/ai-workflow-queue.types.ts
... (其余在各模块的 capability 文件)
```

### 2.2 类别 B：lint/工具链增强（可选回退）

| 文件 | 行数 | 说明 |
|---|---|---|
| `scripts/check-eslint-architecture-fixtures.mjs` | 121 | 架构 fixture 检查脚本 |
| `eslint.config.mjs` | +315 | ESLint 规则增强 |
| `tsconfig.tools.json` | 10 | 工具 tsconfig |
| `jest.config.ts` | +10 | jest 配置增强 |
| `test/jest-e2e.js` | +65 | e2e 配置 |
| `test/jest-type-dependency-extractor.js` | 21 | 类型依赖提取器 |
| `package.json` | +14 | scripts 增强（capability:* / lint:architecture-fixtures / typecheck） |

### 2.3 类别 C：业务代码适配（回退风险高）

这些文件是业务逻辑，因 Capability 引入而做了适配，回退需要逐文件评估：

**Usecase 层（21 文件）：**
- `src/usecases/ai-queue/queue-ai.usecase.ts` (+136)
- `src/usecases/ai-worker/consume-ai-job.usecase.ts` (重构)
- `src/usecases/ai-worker/ai-worker-activation.usecase.ts` (新增 17 行)
- `src/usecases/ai-workflow-worker-activation.usecase.ts` (新增 17 行)
- `src/usecases/email-queue/queue-email.usecase.ts` (+138)
- `src/usecases/email-worker/consume-email-job.usecase.ts` (重构 +195/-)
- `src/usecases/email-worker-activation.usecase.ts` (新增 19 行)
- `src/usecases/auth/login-with-third-party.usecase.ts` (+12)
- `src/usecases/third-party-accounts/generate-weapp-qrcode.usecase.ts` (+33)
- `src/usecases/third-party-accounts/get-weapp-phone.usecase.ts` (+21)
- `src/usecases/account/fetch-user-info.usecase.ts` (+16)
- ... (共 21 个 usecase 文件)

**Module 层（15 文件）：**
- `src/modules/common/ai-queue/ai-queue.service.ts` (重构 -92)
- `src/modules/common/ai-worker/ai-worker.service.ts` (+24)
- `src/modules/common/email-queue/email-queue.service.ts` (+15)
- `src/modules/common/email-worker/email-delivery.service.ts` (+14)
- `src/modules/async-task-record/async-task-record.service.ts` (+23)
- `src/modules/third-party-auth/third-party-auth.service.ts` (+12)
- ... (共 15 个 module 文件)

**Adapter 层（10 文件）：**
- `src/adapters/worker/ai/ai-job.mapper.ts` (重构 -153)
- `src/adapters/worker/ai/ai-job.processor.ts` (+58)
- `src/adapters/worker/ai-workflow/ai-workflow-job.mapper.ts` (新增 178)
- `src/adapters/worker/ai-workflow/ai-workflow-job.processor.ts` (新增 54)
- `src/adapters/worker/capability-worker-activation.spec.ts` (新增 75)
- ... (共 10 个 adapter 文件)

### 2.4 类别 D：文档更新（可选回退）

- `docs/README.md` (重构 -301/+)
- `docs/common/type.rules.md` (+61)
- `docs/common/usecase.rules.md` (+27)
- `docs/common/queryservice.rules.md` (+26)
- `docs/common/boundary-contract.rules.md` (+16)
- `docs/common/eslint-architecture-rules.md` (+31)
- `docs/worker/worker-adapter.rules.md` (+17)
- `docs/worker/worker-usecase.rules.md` (+9)
- `docs/common/rule-precedence.rules.md` (+26)
- `docs/api/adapters.rules.md` (+18)
- `docs/common/entity.rules.md` (+9)
- `docs/common/modules.rules.md` (+9)
- `docs/common/infrastructure.rules.md` (+4)
- `docs/common/aggregate.rules.md` (+2)
- `docs/common/queue-identifiers.rules.md` (+7)
- `docs/common/ai-task-lifecycle-audit.rules.md` (+3)
- `docs/api/graphql-error-contract-current.md` (+4)
- `docs/project-convention/e2e-test-groups.md` (+15)
- `docs/project-convention/input-field-design.md` (重构 +413/-)
- `docs/deprecated/README.md` (+2)
- `docs/worker/qm-worker-integration.rules.md` (+2)
- `docs/project-convention/ai-provider-call-persistence.rules.md` (+4)
- `README.md` (+51)
- `AGENTS.md` (+19)
- `plans/README.md` (+30)

### 2.5 类别 E：其他（不建议回退）

- `env/.env.example` (+124) — 环境变量示例
- `src/core/common/errors/domain-error.ts` (+7) — 错误基类增强
- `src/core/common/text/text.helper.ts` (+19) — 文本工具
- `src/infrastructure/ai/providers/openai/openai-generate.provider.ts` (+5)
- `src/infrastructure/ai/providers/qwen/qwen-generate.provider.ts` (+5)
- `src/infrastructure/bullmq/bullmq.constants.ts` (+7)
- `src/infrastructure/bullmq/contracts/ai-queue.runtime.ts` (+7)
- `src/infrastructure/bullmq/contracts/job-contract.registry.ts` (+11)
- `src/infrastructure/bullmq/producer.gateway.ts` (+6)
- `src/infrastructure/bullmq/queue-registry.ts` (+13)
- `src/infrastructure/graphql/filters/graphql-exception.filter.ts` (+3)
- `src/adapters/api/graphql/ai/dto/string-record.validator.ts` (新增 32)
- `src/adapters/api/graphql/common/input-blank-boundary.spec.ts` (新增 25)
- `tsconfig.json` / `tsconfig.build.json` (各 +2)

---

## 三、用户项目当前状态盘点

### 3.1 用户项目自己额外加的依赖（非老师模板升级）

**这些与"1.6.1 → 1.3.0 回退"无关，回退时不应一并回退：**

| 依赖 | 用户项目当前 | 老师 v1.3.0 | 建议 |
|---|---|---|---|
| `@nestjs/throttler` | ^6.5.0 | 无 | **保留**（限流功能，业务需要） |
| `graphql-upload` | ^17.0.0 | 无 | **保留**（文件上传，业务需要） |
| `sanitize-html` | ^2.17.4 | 无 | **保留**（XSS 清洗，业务需要） |
| `@types/sanitize-html` | ^2.16.1 | 无 | **保留** |
| `@types/graphql-upload` | ^17.0.0 | 无 | **保留** |
| `@types/node` | ^26.1.0 | ^25.9.1 | **保留**（降级会引发类型问题） |
| `@nestjs/common` | ^11.1.27 | ^11.1.22 | **保留**（仅 patch 版本差异） |
| `@nestjs/core` | ^11.1.27 | ^11.1.22 | **保留** |
| `@nestjs/platform-express` | ^11.1.27 | ^11.1.22 | **保留** |
| `@nestjs/cli` | ^11.0.23 | ^11.0.21 | **保留** |
| `@nestjs/testing` | ^11.1.27 | ^11.1.22 | **保留** |
| `axios` | ^1.18.1 | ^1.16.1 | **保留** |
| `bullmq` | ^5.79.2 | ^5.76.10 | **保留** |
| `ioredis` | ^5.11.1 | ^5.10.1 | **保留** |
| `mysql2` | ^3.22.5 | ^3.22.3 | **保留** |
| `ws` | ^8.21.0 | ^8.20.1 | **保留** |
| `eslint` | ^10.6.0 | ^10.4.0 | **保留** |
| `prettier` | ^3.9.4 | ^3.8.3 | **保留** |
| `typescript-eslint` | ^8.62.1 | ^8.59.4 | **保留** |
| `@swc/core` | ^1.15.43 | ^1.15.33 | **保留** |
| `ts-loader` | ^9.6.2 | ^9.5.4 | **保留** |
| `packageManager` | npm@11.18.0 | npm@11.12.0 | **保留** |

### 3.2 用户项目业务代码对 Capability 的依赖（回退难点）

**16 个文件使用 `@CapabilityAnchorProvider` 装饰器：**

```
src/modules/account/account.capability.ts
src/modules/auth/auth.capability.ts
src/modules/third-party-auth/third-party-auth.capability.ts
src/modules/verification-record/verification-record.capability.ts
src/modules/async-task-record/async-task-record.capability.ts
src/modules/ai-workflow-context/ai-workflow.capability.ts
src/modules/common/email-worker/email-sendmail.capability.ts
src/modules/common/ai-capability/ai-capability.providers.ts
... (共 16 个)
```

**25 个文件引用 CapabilityModule/CapabilityRuntime/CapabilityGraph：**
包括各业务 module 文件、usecase 文件、spec 文件等。

---

## 四、回退策略（三选一）

### 策略一：最小回退（推荐先试）[已完成 2026-07-22]

**目标**：只回退工具脚本和 lint 增强，让 AI 生成代码时不受 Capability 规则约束，但业务代码保留 Capability。

**操作步骤**：

1. **备份当前状态**：
   ```bash
   git branch backup-pre-rollback-1.3
   ```

2. **package.json scripts 回退**：
   - 移除 `prebuild:api` 中的 `&& npm run capability:docs:check`
   - 移除 `lint` 中的 `npm run capability:docs:check &&` 和 `npm run lint:architecture-fixtures &&`
   - 移除 `typecheck` 中的 `&& tsc -p tsconfig.tools.json --noEmit`
   - 移除 `capability:list` / `capability:docs` / `capability:docs:check` 三条脚本
   - 移除 `lint:architecture-fixtures` 脚本

3. **删除工具脚本文件**：
   - `scripts/capability-list.ts`
   - `scripts/check-eslint-architecture-fixtures.mjs`
   - `tsconfig.tools.json`

4. **eslint.config.mjs 回退**：
   - 对照老师 v1.3.0 的 `eslint.config.mjs`，移除 +315 行的架构规则增强
   - 保留基础 ESLint 规则

5. **保留所有业务代码和 Capability 系统核心**：
   - `src/infrastructure/capability/` 全部保留
   - 各 `*.capability.ts` 文件全部保留
   - 所有 usecase / module / adapter 保留

6. **验证**：
   ```bash
   npx tsc --noEmit
   npm run lint:usecase-normalize-guard && eslint "src/**/*.ts" --fix
   npx jest
   ```

**预期效果**：
- AI 生成代码时不再受 capability:docs:check 约束
- 业务代码 Capability 运行时仍然正常工作
- 风险最低，但 AI 适配性改善有限（业务代码里的 Capability 装饰器仍然存在）

**风险**：低

#### 实际执行记录（2026-07-22）

| 步骤 | 实际操作 | 结果 |
|---|---|---|
| 1. 打 backup 分支 | `git branch backup-pre-rollback-1.3` | 成功 |
| 2. 缓存 v1.3.0 文件 | `git archive fc25369 \| tar -x -C /tmp/rollback-ref/v1.3.0` | 成功 |
| 3. package.json scripts | 移除 6 处：`prebuild:api` 中的 `capability:docs:check`、`lint` 中的 capability/architecture-fixtures、`typecheck` 中的 `tsconfig.tools.json`、`capability:list/docs/docs:check` 三条脚本、`lint:architecture-fixtures` 脚本 | 成功 |
| 4. 删除工具文件 | 删除 `scripts/capability-list.ts`、`scripts/check-eslint-architecture-fixtures.mjs`、`tsconfig.tools.json` | 成功 |
| 5. eslint.config.mjs 回退 | **重要**：未直接用老师 v1.3.0 覆盖，而是用本项目 commit `c27ba64` (v1.4.0) 的版本恢复。原因：本项目 v1.4.0 相对 v1.3.0 多了 4 行 `[KEPT:业务保留] pagination.service` 业务保留逻辑，必须保留。v1.4.0 → v1.6.1 共 350 行 diff 全部被回退 | 1929 行（v1.6.1 是 2200 行，回退 271 行） |
| 6. tsc 验证 | `npx tsc --noEmit` | 0 错误 |
| 7. eslint 验证 | `npx eslint "{src,apps,libs,test}/**/*.ts" --fix` | 0 错误 0 警告 |
| 8. jest 验证 | `npx jest` | **102 suites / 730 tests 全部通过** |

**保留未动**（策略一原则）：
- `src/infrastructure/capability/` 整个目录（12 文件）
- 21 个 `*.capability.ts` 文件
- 所有 usecase / module / adapter 业务代码
- `package.json` 中用户自加依赖（`@nestjs/throttler`、`graphql-upload`、`sanitize-html` 等）

**待用户验证**：
- 国产 AI 适配性测试（生成 3-5 段代码评估实际效果）

---

### 策略二：中等回退（在策略一基础上追加）[待执行]

**目标**：在策略一基础上，额外回退 docs 中的 Capability 规范文档，让 AI 完全看不到 Capability 规则。

**追加步骤**：

1. **删除 Capability 规范文档**：
   - `docs/common/capability.rules.md`
   - `docs/common/capability-plugin.rules.md`
   - `docs/common/capability-boundary-examples.md`
   - `docs/common/capability-plugin-authoring.guide.md`
   - `docs/capabilities/current.md`
   - `docs/generated/capabilities-current.md`
   - `docs/deprecated/capability-plugin-plan.md`

2. **回退其他 docs 到 v1.3.0 状态**：
   - 对照老师 v1.3.0 恢复 `docs/common/type.rules.md`、`docs/common/usecase.rules.md` 等
   - 注意：用户项目可能在 v1.3.0 后自己改过这些 docs，需逐文件 diff

3. **保留业务代码 Capability 实现**（同策略一）

**预期效果**：
- AI 在阅读项目 docs 时不会看到 Capability 规则
- 但业务代码里的 `*.capability.ts` 文件仍存在，AI 生成新代码时可能模仿

**风险**：中（docs 与代码不一致，可能让 AI 困惑）

---

### 策略三：完整回退（高风险，不推荐）[待执行]

**目标**：把 Capability 系统完整移除，业务代码全部回退到 v1.3.0 状态。

**追加步骤**（在策略二基础上）：

1. **删除 Capability 系统核心**：
   - 删除 `src/infrastructure/capability/` 整个目录（12 文件）
   - 删除 `src/types/common/capability.types.ts`
   - 删除 `src/types/common/capability-id.types.ts`（用户项目自建）
   - 删除所有 `*.capability.ts` 文件（21 个）
   - 删除 `test/support/capability/` 目录

2. **修改 bootstrap 模块**：
   - `src/bootstraps/api/api.module.ts` 移除 CapabilityModule 引入
   - `src/bootstraps/worker/worker.module.ts` 移除 CapabilityModule 引入
   - `src/infrastructure/config/config.module.ts` 移除 capability 配置

3. **逐文件回退业务代码**（共 46 个文件）：
   - 对照老师 v1.3.0 恢复所有 usecase（21 个）、module（15 个）、adapter（10 个）
   - 注意：用户项目可能在 v1.3.0 后自己改过这些文件，需逐文件 diff

4. **回退 env/.env.example**：
   - 移除 v1.6.1 新增的 capability 相关环境变量

5. **回退 graphql-exception.filter.ts / domain-error.ts 等**：
   - 对照 v1.3.0 恢复

6. **全面验证**：
   ```bash
   npx tsc --noEmit
   npx eslint "src/**/*.ts" --fix
   npx jest
   npm run test:e2e:all
   ```

**预期效果**：
- 项目完全回到 v1.3.0 架构
- AI 适配性最佳

**风险**：**极高**
- 46 个业务文件需要逐个对照 v1.3.0 恢复，但用户项目可能在 v1.3.0 后自己改过这些文件
- 用户的业务功能（博客、AIGC、第三方登录等）可能依赖 Capability 运行时门控
- 测试覆盖可能不足，难以发现回归
- 工作量巨大，预计需要数轮 tsc/eslint 修复

---

## 五、推荐执行顺序

### 5.1 第一阶段：准备 [已完成 2026-07-22]

```bash
# 1. 确保工作区干净
cd /home/heilong_lyhy/aigc/aigc-friendly-backend
git status

# 2. 打备份分支
git branch backup-pre-rollback-1.3

# 3. 缓存老师 v1.3.0 的关键文件到临时目录，便于对照
mkdir -p /tmp/rollback-ref/v1.3.0
cd ~/aigc-template/aigc-friendly-backend
git archive fc25369 | tar -x -C /tmp/rollback-ref/v1.3.0
```

### 5.2 第二阶段：执行策略一 [已完成 2026-07-22]

按"四、策略一"步骤执行，每步执行后跑 tsc 验证。

### 5.3 第三阶段：评估 [待执行]

策略一执行后，让国产 AI 实际生成几段代码测试适配性：
- 如果 AI 生成质量可接受 → 停止，提交
- 如果 AI 仍频繁出错 → 考虑追加策略二
- 如果策略二仍不够 → 评估是否值得承担策略三的风险

### 5.4 第四阶段：提交 [待执行]

```bash
git add -A
git commit -m "chore(framework): 回退 1.6.1 框架升级到 1.3.0 基线（保留业务代码）"
```

---

## 六、回退操作检查清单

执行回退时逐项打勾：

### 策略一检查清单

- [x] 打 backup 分支 `backup-pre-rollback-1.3`
- [x] 缓存老师 v1.3.0 文件到 `/tmp/rollback-ref/v1.3.0/`
- [x] `package.json` scripts 回退（移除 capability:* / lint:architecture-fixtures / tsconfig.tools.json）
- [x] 删除 `scripts/capability-list.ts`
- [x] 删除 `scripts/check-eslint-architecture-fixtures.mjs`
- [x] 删除 `tsconfig.tools.json`
- [x] `eslint.config.mjs` 对照 v1.3.0 回退（移除 +315 行架构规则）
- [x] `npx tsc --noEmit` 通过
- [x] `npx eslint "src/**/*.ts" --fix` 通过
- [x] `npx jest` 通过（102 suites / 730 tests passed）
- [ ] 国产 AI 适配性测试（生成 3-5 段代码评估）

### 策略二追加检查清单

- [ ] 删除 7 个 Capability 规范文档
- [ ] 对照 v1.3.0 恢复其他 docs（注意用户项目自改部分）
- [ ] `npx tsc --noEmit` 通过
- [ ] `npx eslint "src/**/*.ts" --fix` 通过
- [ ] `npx jest` 通过
- [ ] 国产 AI 适配性测试

### 策略三追加检查清单

- [ ] 删除 `src/infrastructure/capability/` 整个目录
- [ ] 删除 `src/types/common/capability.types.ts` 和 `capability-id.types.ts`
- [ ] 删除 21 个 `*.capability.ts` 文件
- [ ] 删除 `test/support/capability/` 目录
- [ ] `src/bootstraps/api/api.module.ts` 移除 CapabilityModule
- [ ] `src/bootstraps/worker/worker.module.ts` 移除 CapabilityModule
- [ ] `src/infrastructure/config/config.module.ts` 移除 capability 配置
- [ ] 21 个 usecase 文件对照 v1.3.0 恢复
- [ ] 15 个 module 文件对照 v1.3.0 恢复
- [ ] 10 个 adapter 文件对照 v1.3.0 恢复
- [ ] `env/.env.example` 移除 capability 环境变量
- [ ] `src/infrastructure/graphql/filters/graphql-exception.filter.ts` 对照 v1.3.0 恢复
- [ ] `src/core/common/errors/domain-error.ts` 对照 v1.3.0 恢复
- [ ] `npx tsc --noEmit` 通过
- [ ] `npx eslint "src/**/*.ts" --fix` 通过
- [ ] `npx jest` 通过
- [ ] `npm run test:e2e:all` 通过
- [ ] 手动测试核心业务流程（登录、博客、AIGC、第三方认证）

---

## 七、回滚回 1.6.1 的方法

如果回退后发现问题，需要恢复到 1.6.1：

```bash
# 方式一：硬重置到 backup 分支
git reset --hard backup-pre-rollback-1.3

# 方式二：如果已经 commit 回退，用 revert
git revert <rollback-commit-hash>
```

---

## 八、关键参考命令

### 8.1 对照老师 v1.3.0 恢复单个文件

```bash
# 例如恢复 eslint.config.mjs
cd ~/aigc-template/aigc-friendly-backend
git show fc25369:eslint.config.mjs > /home/heilong_lyhy/aigc/aigc-friendly-backend/eslint.config.mjs
```

### 8.2 查看某文件在 v1.3.0 → v1.6.1 之间的完整 diff

```bash
cd ~/aigc-template/aigc-friendly-backend
git diff fc25369..HEAD -- <file-path>
```

### 8.3 列出用户项目当前所有 capability 相关文件

```bash
cd /home/heilong_lyhy/aigc/aigc-friendly-backend
find src -name '*capability*' -type f
grep -r '@CapabilityAnchorProvider' src/ --include='*.ts' -l
grep -r 'CapabilityModule\|CapabilityRuntime\|CapabilityGraph' src/ --include='*.ts' -l
```

### 8.4 验证回退是否彻底

```bash
# 应该无输出（如果完整回退了 Capability）
grep -r 'Capability' src/ --include='*.ts' -l
grep -r 'capability' package.json
```

---

## 九、风险提示

1. **用户项目可能在 v1.3.0 后自己改过业务文件**：回退时不能盲目覆盖，必须 diff 确认
2. **测试覆盖不足**：用户项目 jest 730 个测试，但 e2e 测试覆盖度未知，回退后需手动测试核心流程
3. **Capability 运行时门控**：业务代码（如 `email-queue.service.ts`）可能用 `requireEnabled(NOTIFICATION_EMAIL_CAPABILITY_ID)` 做运行时门控，移除 Capability 后需替换为硬编码 `true` 或其他门控机制
4. **依赖耦合**：用户项目自己加的 `@nestjs/throttler` 等依赖与老师 v1.3.0 无关，不应一并回退
5. **docs 与代码一致性**：策略二会让 docs 与代码不一致，可能让 AI 更困惑

---

## 十、附录：老师 v1.3.0 → v1.6.1 完整 186 文件清单

完整 diff stat 缓存在 `/tmp/v1.3-to-v1.6.1-diff.txt`，可随时查阅。

### 关键 commit 引用

- 老师 v1.3.0：`fc25369 chore(release): 更新版本号到 1.3.0`
- 老师 v1.4.0：`0984a3d chore(release): 更新版本号到 1.4.0`
- 老师 v1.6.1（当前 HEAD）：`dba1a49 docs(architecture): 明确类型归属与边界规则`
- 用户项目当前 HEAD：`60ef5df fix(security): 安全审计修复 — JWT/XSS/加密/限流/文件上传 + B14-B17 盲区`
- 用户项目 v1.4→v1.6 升级 commit：`4743e1f chore: v1.4→v1.6 框架升级对齐 + JWT/blog/端口默认值修复`
- 用户项目 v1.4.0 升级 commit：`c27ba64 chore: v1.4.0 框架升级对齐 + 架构规范修复`
- 用户项目 v1.6.1 收尾 commit：`e80ec9e chore(architecture): 删除 magic-item-craft 测试模块 + 清理 stale spec + 框架升级对齐收尾`
