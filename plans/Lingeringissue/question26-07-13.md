# 遗留问题清单 - 2026-07-13

> 本文件记录全局架构 review 过程中发现但未能直接修复的问题。
> 标记说明：[未解决] / [已解决]

---

## 1. `runtime.async-task` capability ID 在 `src/modules/common/*` 中以字面量保留

- **状态**：[未解决]
- **规范依据**：`docs/common/modules.rules.md` — "`src/modules/common/*` 反向依赖业务域模块" 禁止；capability ID 应由对应的 capability anchor 文件单一定义、其他位置引用常量
- **现状**：
  - `runtime.async-task` capability ID 的常量定义位于 `src/modules/async-task-record/async-task-record.capability.ts`（`RUNTIME_ASYNC_TASK_CAPABILITY_ID`）。
  - 该 capability 的归属模块 `async-task-record` 属于业务域模块。
  - `src/modules/common/email-queue/email-queue.service.ts` 和 `src/modules/common/email-worker/email-delivery.service.ts` 在 `@CapabilityRuntimeContributionProvider` 的 `runtimeDependencies` 中需要声明对 `runtime.async-task` 的 optional 依赖。
  - 由于 `src/modules/common/*` 禁止反向依赖业务域模块，无法从 `async-task-record.capability.ts` 导入常量。
  - 当前在两个文件中均以字符串字面量 `'runtime.async-task'` 出现，并附注释说明保留原因。
  - 这是与项目"capability ID 由 anchor 单一定义"约定的偏离，但在当前分层规则下无法直接消除。
- **影响**：
  - 字面量与常量定义形成并行口径，若 anchor 文件中的 ID 字符串发生重命名，这两处不会自动同步，存在漂移风险。
  - 仅影响 `runtime.async-task` 这一个跨 `common → 业务域` 引用的能力 ID，其他 capability ID 已在本次 review 中统一替换为常量。
- **修复方案**（待评估）：
  1. **方案 A**：将 `RUNTIME_ASYNC_TASK_CAPABILITY_ID` 常量提升到 `src/modules/common/` 下的共享常量文件（如 `src/modules/common/async-task-capability.constants.ts`），让 `async-task-record.capability.ts` 反向从 common 导入。需评估这是否破坏 capability ID "归属 anchor 文件"的语义。
  2. **方案 B**：将 `runtime.async-task` capability anchor 本身迁移到 `src/modules/common/` 下，由 common 层拥有该运行时能力 ID 的定义。需评估该能力是否真的属于横切通用能力而非业务域能力。
  3. **方案 C**：在 `src/types/` 中新增 capability ID 注册表（如 `src/types/common/capability-ids.types.ts`），集中存放所有 capability ID 常量，anchor 文件和消费方均从 types 层导入。需评估这是否引入新的集中化反模式。
- **涉及文件**（修复时需改动）：
  - `src/modules/async-task-record/async-task-record.capability.ts`
  - `src/modules/common/email-queue/email-queue.service.ts`
  - `src/modules/common/email-worker/email-delivery.service.ts`
  - 可能涉及的方案 A/B/C 对应的新增文件
- **风险**：
  - capability anchor 归属变更可能影响 capability registry 的注册顺序和依赖图。
  - 集中化 capability ID 注册表可能被滥用为新的"全局 ports 层"，违反 `docs/common/boundary-contract.rules.md` 中"不建立全局 boundary contract 层"的约束。
  - 任何方案都需配合 ESLint 规则验证，确保不引入新的跨层违规。

---

## 2. `maskEmail` 方法在 email-queue 与 email-delivery 中重复实现

- **状态**：[未解决]
- **规范依据**：项目原则 — 避免同一逻辑的二次实现；`docs/common/modules.rules.md` — `src/core/common/` 承载纯领域规则与通用辅助
- **现状**：
  - `src/modules/common/email-queue/email-queue.service.ts` 的 `private maskEmail(email: string): string` 方法（7 行）用于日志脱敏。
  - `src/modules/common/email-worker/email-delivery.service.ts` 的 `private maskEmail(email: string): string` 方法（7 行）实现完全相同。
  - 两处均为私有方法，逻辑一致：local part ≤2 字符时保留首字符 + `***`，否则保留前 2 字符 + `***`，域名原样保留。
  - `src/core/common/text/text.helper.ts` 当前未提供 email 脱敏工具。
- **影响**：
  - 重复实现属于轻量级二次实现，维护时存在两处不同步的风险。
  - 当前影响范围有限：仅 7 行工具逻辑，且两处实现完全一致。
- **未直接修复的原因**：
  - 按项目"不为单次使用创建抽象"的工程原则，仅在两处重复时抽取共享工具的收益较小。
  - 更合适的归属位置是 `src/core/common/text/` 下新增 `mask-email.helper.ts`，但这涉及 core 层的新增文件，应作为有计划的改动而非顺手抽取。
- **修复方案**（待评估）：
  1. 在 `src/core/common/text/mask-email.helper.ts` 新增 `maskEmail(email: string): string` 纯函数。
  2. 在 `src/core/common/text/index.ts`（若存在 barrel）或直接路径导出。
  3. `email-queue.service.ts` 和 `email-delivery.service.ts` 改为从 `@core/common/text/mask-email.helper` 导入，移除私有方法。
  4. 可选：为该 helper 补充单元测试，覆盖 local part 长度边界、无 `@` 的非法输入、空字符串等场景。
- **涉及文件**（修复时需改动）：
  - `src/core/common/text/mask-email.helper.ts` — 新增
  - `src/modules/common/email-queue/email-queue.service.ts` — 移除私有方法，改为导入
  - `src/modules/common/email-worker/email-delivery.service.ts` — 移除私有方法，改为导入
- **风险**：
  - 风险极低：纯函数迁移，无副作用，无状态。
  - 需确认 `@core/common/text` 路径别名在 tsconfig 中已配置（当前 `text.helper.ts` 已存在并被使用，路径别名应已可用）。

---

## 本次 review 已修复项（供对照）

> 以下问题在 2026-07-13 的 review 中已直接修复，此处仅作记录以便与未解决项对照。

### 3. capability ID 字符串字面量在 services / usecases / gates 中重复出现

- **状态**：[已解决]
- **修复**：
  - 将 `src/modules/ai-workflow-context/ai-workflow.capability.ts` 的 `requires: ['ai.execution']` 改为 `[AI_EXECUTION_CAPABILITY_ID]`。
  - 将 `src/modules/ai-workflow-context/ai-workflow-capability.gate.ts` 中的 `'ai.workflow'` / `'ai.execution'` 字面量替换为 `AI_WORKFLOW_CAPABILITY_ID` / `AI_EXECUTION_CAPABILITY_ID`。
  - 将 `src/modules/ai-workflow-context/queue/ai-workflow-queue.service.ts` 中 `capabilityId` 与 `requireEnabled` 的 `'ai.workflow'` 字面量替换为 `AI_WORKFLOW_CAPABILITY_ID`。
  - 将 `src/modules/common/ai-queue/ai-queue.service.ts` 中 `'ai.execution'` 字面量替换为 `AI_EXECUTION_CAPABILITY_ID`。
  - 将 `src/modules/common/ai-worker/ai-worker.service.ts` 中 `'ai.execution'` 字面量替换为 `AI_EXECUTION_CAPABILITY_ID`。
  - 将 `src/modules/common/email-queue/email-queue.service.ts` 中 `'runtime.email-delivery'` 字面量替换为 `RUNTIME_EMAIL_DELIVERY_CAPABILITY_ID`。
  - 将 `src/modules/common/email-worker/email-delivery.service.ts` 中 `'runtime.email-delivery'` 字面量替换为 `RUNTIME_EMAIL_DELIVERY_CAPABILITY_ID`。
  - 将 `src/modules/common/email-worker/email-sendmail.capability.ts` 中 `'notification.email'` 字面量替换为 `NOTIFICATION_EMAIL_CAPABILITY_ID`。
  - 将 `src/usecases/ai-worker/ai-worker-activation.usecase.ts` 中 `'ai.execution'` 字面量替换为 `AI_EXECUTION_CAPABILITY_ID`。
  - 将 `src/usecases/ai-worker/ai-workflow-worker-activation.usecase.ts` 中 `'ai.workflow'` 字面量替换为 `AI_WORKFLOW_CAPABILITY_ID`。
  - 将 `src/usecases/email-worker/email-worker-activation.usecase.ts` 中 `'runtime.email-delivery'` 字面量替换为 `RUNTIME_EMAIL_DELIVERY_CAPABILITY_ID`。
  - 将 `src/usecases/ai-workflow/run-ai-workflow-housekeeping.usecase.ts` 中 `'ai.workflow'` 字面量替换为 `AI_WORKFLOW_CAPABILITY_ID`。
- **验证**：ESLint（受影响模块）通过；`npm run typecheck` 通过；9 套件 / 31 用例单元测试全部通过。
