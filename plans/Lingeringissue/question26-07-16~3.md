# 遗留问题清单 - 2026-07-16 第四轮 review

> 本文件记录全局架构检查第四轮 review 中新发现的问题，主要聚焦最近一次 `pagination.query.service.ts` / `pagination.module.ts` 引入后产生的分层架构偏离与重复实现。
> 审计方法：import 级依赖方向 + 方法体语义级深审（覆盖 B1-B9 盲区）+ 同功能二次实现扫描 + docs 规范偏离检查
> 前置文档：`question26-07-16.md`、`question26-07-16~2.md`（capability-bus 已完成最终修复）

---

## 上一轮已修复确认

第三轮标记"已解决"的所有项目在 2026-07-16 15:50 之后的状态：

| # | 问题 | 最终状态 |
|---|------|---------|
| 3 | `capability-bus.contract.ts` 通用 Bus 抽象 | [已解决] — 文件已完全删除；`DirectReferenceProfileClient` 直接注入 `REFERENCE_PROFILE_LIST_HANDLER`；`CAPABILITY_QUERY_BUS` / `CapabilityQueryBus` 全项目无残留引用 |
| 15 | `async-task-record` capability ID 字面量 | [已解决] — 无 `'runtime.async-task'` 字面量残留 |
| 16 | `third-party-auth` capability ID 字面量 | [已解决] — 无 `'identity.external-account'` 字面量残留 |

---

## 第四轮 review 新发现问题

### 19. `PaginationModule`（modules/common）镜像重复了 `TypeOrmPaginationModule`（infrastructure），并直接 import 具体基础设施实现类（B5 + 第三步 — 同功能二次实现）

- **状态**：[未解决]
- **严重度**：中
- **规范依据**：
  - `docs/common/infrastructure.rules.md`："Infrastructure 中的实现只依赖被实现的 boundary contract、必要的纯类型与底层技术组件。"
  - `docs/capabilities/current.md` 的分层职责隐含约束：DI 装配工作属于 infrastructure 层职责。
  - `docs/common/modules.rules.md`："modules 层的 module.ts 负责聚合本域 services/query services，DI 装配应委托给对应的 infrastructure 装配模块。"
- **现状**：
  - 已有专用的基础设施装配模块：`src/infrastructure/typeorm/pagination/typeorm-pagination.module.ts`，封装了 `HmacCursorSigner` + `TypeOrmPaginator` + `TypeOrmSort` 的 DI wiring，并使用 `@core/pagination/pagination.tokens` 的 token。
  - 新建 `src/modules/common/pagination.module.ts`（2026-07-16 创建）完整复制了上述装配：
    ```typescript
    // 同样的 provide + useFactory 逻辑
    // 同样的 HmacCursorSigner/TypeOrmPaginator/TypeOrmSort 实例化
    ```
  - 新文件直接 import 三个具体基础设施实现类（`HmacCursorSigner` / `TypeOrmPaginator` / `TypeOrmSort`），而非 import 已有的 `TypeOrmPaginationModule`：
    ```typescript
    import { HmacCursorSigner } from '@src/infrastructure/security/hmac-signer';
    import { TypeOrmPaginator } from '@src/infrastructure/typeorm/pagination/typeorm-paginator';
    import { TypeOrmSort } from '@src/infrastructure/typeorm/sort/typeorm-sort';
    ```
  - `TypeOrmPaginationModule` 现已无任何引用方（`grep TypeOrmPaginationModule src/` 仅命中定义处），成为死代码。
  - `PaginationModule` 被 `src/modules/blog/blog.module.ts` 实际引用（替换了原本应该走 `TypeOrmPaginationModule` 的路径）：
    ```typescript
    // blog.module.ts
    imports: [TypeOrmModule.forFeature(BLOG_ENTITIES), PaginationModule, BlogStorageModule],
    ```
- **影响**：
  - **职责混淆**：分页相关的 DI 装配现在由 `modules/common` 层负责，跨层持有具体实现类（`HmacCursorSigner`/`TypeOrmPaginator`/`TypeOrmSort`），分层语义被打破。
  - **可替换性下降**：当未来要切换分页实现（如非 TypeORM 适配、内存 mock、ClickHouse 等），需要同时修改 `TypeOrmPaginationModule`（infrastructure）和 `PaginationModule`（modules/common）两处装配。
  - **代码重复**：同一组 `useFactory` 逻辑在两个文件中各维护一份，存在分歧漂移风险。
  - **死代码堆积**：`TypeOrmPaginationModule` 已无引用但未删除。
- **修复方案**：
  1. **方案 A（推荐）**：删除 `src/modules/common/pagination.module.ts` 中的全部 `useFactory` 装配逻辑，改为 `imports: [TypeOrmPaginationModule]`，仅保留 `PaginationQueryService` 的 provider/export。
  2. **方案 B**：如果坚持由 modules/common 拥有 `PaginationQueryService`，则在 `src/modules/common/pagination.module.ts` 中仅保留对 `TypeOrmPaginationModule` 的 imports + 自身的 service provider，不再 instantiate 任何具体类。
  3. 删除 `src/modules/common/tokens/pagination.tokens.ts`（参见 #20）。
  4. 评估 `TypeOrmPaginationModule` 是否仍保留——若方案 A/B 实施后无引用方，则删除；若保留作为 API 边界，则需有人主动引用。
- **涉及文件**：
  - `src/modules/common/pagination.module.ts`（重写）
  - `src/modules/common/tokens/pagination.tokens.ts`（可能删除）
  - `src/infrastructure/typeorm/pagination/typeorm-pagination.module.ts`（可能删除/保留）
  - `src/modules/blog/blog.module.ts`（确认 imports 路径）
  - `src/core/pagination/pagination.tokens.ts`（评估是否与新 tokens 合并）
- **风险**：
  - 当前 `PaginationQueryService` 通过 `modules/common/tokens/pagination.tokens.ts` 的 token 注入，而 `TypeOrmPaginationModule` 通过 `@core/pagination/pagination.tokens` 的 token 注入。两者 Symbol 名称虽然相同（`PAGINATOR`/`CURSOR_SIGNER`）但实际是不同的 Symbol 对象，DI 容器会独立处理——即改用 `TypeOrmPaginationModule` 后，需要同步将 `PaginationQueryService` 的 `@Inject` 切换为 core tokens。
  - 切换时需要重新跑单测验证 `PaginationQueryService` 仍能正确接收 paginator。

---

### 20. `PAGINATION_TOKENS` 在 core 和 modules/common 双份定义（同功能二次实现 — 第三步）

- **状态**：[未解决]
- **严重度**：中
- **规范依据**：
  - `docs/common/type.rules.md`：四层类型模型中，DI token 作为可被多引用的契约应只有单一真源。
  - 单一真源原则：相同语义的 token 不应在多处独立声明。
- **现状**：
  - **core 真源**：`src/core/pagination/pagination.tokens.ts`
    ```typescript
    export const PAGINATION_TOKENS = {
      PAGINATOR: Symbol('PAGINATOR'),
      CURSOR_SIGNER: Symbol('CURSOR_SIGNER'),
    } as const;
    ```
  - **modules/common 副本**：`src/modules/common/tokens/pagination.tokens.ts`
    ```typescript
    // 与 core 完全相同的内容
    export const PAGINATION_TOKENS = {
      PAGINATOR: Symbol('PAGINATOR'),
      CURSOR_SIGNER: Symbol('CURSOR_SIGNER'),
    } as const;
    ```
  - 两份 token 的 Symbol 对象是不同的（`Symbol('PAGINATOR') !== Symbol('PAGINATOR')`），但语义完全相同。
  - **引用关系**：
    - `core/pagination.tokens` ← 被 `infrastructure/typeorm/pagination/typeorm-pagination.module.ts` 引用（仅 1 处）
    - `modules/common/tokens/pagination.tokens` ← 被 `modules/common/pagination.module.ts` 和 `modules/common/pagination.query.service.ts` 引用
  - 由于 `TypeOrmPaginationModule` 已无任何使用方（参见 #19），`core/pagination.tokens` 当前处于"仅基础设施模块引用、但该模块已无外部引用方"的状态。
- **影响**：
  - 两份独立 token 定义给 DI 装配带来歧义：新读者难以判断应当用哪一份。
  - 若两个 Module 同时注册（虽然当前不会发生），将产生两个独立的 `PAGINATOR` 提供者，违反 NestJS DI 唯一性。
  - 增加后续迁移/重构成本。
- **修复方案**：
  1. 删除 `src/modules/common/tokens/pagination.tokens.ts`。
  2. 将 `src/modules/common/pagination.module.ts` 和 `src/modules/common/pagination.query.service.ts` 中的 `PAGINATION_TOKENS` 来源切换为 `@core/pagination/pagination.tokens`。
  3. 评估 `core/pagination/pagination.tokens.ts` 与 `core/pagination/pagination.contract.ts` 等是否需要合并到 `pagination.types.ts`（可选）。
- **涉及文件**：
  - `src/modules/common/tokens/pagination.tokens.ts`（删除）
  - `src/modules/common/pagination.module.ts`（改 import 路径）
  - `src/modules/common/pagination.query.service.ts`（改 import 路径）
  - `src/core/pagination/pagination.tokens.ts`（保留，作为唯一真源）
- **风险**：低——单点替换。

---

### 21. `SearchModule`（modules/common）镜像重复了 `TypeOrmSearchModule`（infrastructure），且整体为死代码（B7 + 第三步）

- **状态**：[未解决]
- **严重度**：低
- **规范依据**：
  - `docs/common/infrastructure.rules.md`：DI 装配属于 infrastructure 职责。
  - `docs/audit_reports/method_audit_blind_spots.md` B7：死代码应被清除。
- **现状**：
  - `src/infrastructure/typeorm/search/typeorm-search.module.ts` 提供了完整的 `TypeOrmSearchModule`（使用 `SEARCH_ENGINE_TOKEN`）。
  - `src/modules/common/search.module.ts` 又实现了一份 `SearchModule`，同样 import `TypeOrmSearch`：
    ```typescript
    import { TypeOrmSearch } from '@src/infrastructure/typeorm/search/typeorm-search';
    // ...
    { provide: SEARCH_TOKENS.ENGINE, useClass: TypeOrmSearch },
    ```
  - `SearchModule` 与 `SearchService` 整个文件**全项目无任何引用方**：
    ```
    grep SearchModule → 仅命中定义
    grep SearchService → 0 命中
    grep 'from "@modules/common/search.module"' → 0 命中
    ```
  - `TypeOrmSearchModule` 也未被任何模块 import：
    ```
    grep TypeOrmSearchModule → 仅命中定义
    ```
  - 整个搜索能力在生产代码中无人使用——`PaginationQueryService`（参见 #19）已承担实际的分页+搜索需求。
- **影响**：
  - 死代码：未使用的 module、service、token 全部留在代码库。
  - 镜像重复：与 #19 同源，重复的 DI 装配模式（modules/common 直接 import 具体基础设施类）。
- **修复方案**：
  1. 删除整个 `src/modules/common/search.module.ts` 文件。
  2. 评估 `src/infrastructure/typeorm/search/typeorm-search.module.ts` 与 `TypeOrmSearch` 类的去留——若 search 能力确实未被任何 usecase 消费，则整个 typeorm/search 子树也可删除。
  3. 如未来需要重新引入 search 能力，按 `PaginationModule` 修复方案（#19 方案 A）走标准装配路径。
- **涉及文件**：
  - `src/modules/common/search.module.ts`（删除）
  - `src/infrastructure/typeorm/search/typeorm-search.module.ts`（评估删除）
  - `src/infrastructure/typeorm/search/typeorm-search.ts`（评估删除）
- **风险**：低——确认无任何引用方后即可删除。

---

### 22. `pagination.module.ts` / `search.module.ts` 在 modules 层持有具体基础设施实现类（B7 + 设计改进点）

- **状态**：[未解决]（与 #19、#21 同源，独立条目以保留 B7 维度的可见性）
- **严重度**：中
- **规范依据**：
  - `docs/audit_reports/method_audit_blind_spots.md` B7："扫描每个业务域目录下的 `interfaces/` 和 `contracts/`，检查是否有同名接口/类型重复定义"（B7 的核心思想：识别 modules 层做 infrastructure 职责的反模式）。
  - `docs/common/infrastructure.rules.md`：装配属于 infrastructure 职责。
  - ESLint 当前规则 `boundaries/dependencies` 允许 `modules -> infrastructure`，因此不报错——但这是结构性反模式。
- **现状**：
  - `grep -rn "from '@src/infrastructure/" src/modules/ --include="*.ts" | grep -v ".contract.ts"` 仅 2 处命中：
    - `src/modules/common/pagination.module.ts:10-12`（HmacCursorSigner、TypeOrmPaginator、TypeOrmSort）
    - `src/modules/common/search.module.ts:8`（TypeOrmSearch）
  - 两个文件均**完整实例化**具体类（`useFactory: () => new HmacCursorSigner(secret)` 等），不是简单 import 类型。
- **影响**：
  - 与本轮 #9（auth→account 直接依赖）的性质类似：ESLint 允许，但属于分层语义反模式。
  - 任何"我以为 modules 层只关心业务"的开发者都会在阅读 `pagination.module.ts` 时产生认知冲突。
- **修复方案**：
  1. 参见 #19、#21 的修复方案——本质上是同一问题。
  2. 长期建议：在 ESLint 规则集新增 `no-modules-to-infrastructure-concrete-imports`（或扩展现有规则），禁止 modules 层的 `*.module.ts` 文件 `import` infrastructure 层的具体实现类（`useClass`/`useFactory`），只允许 import 已被 `*.contract.ts` 抽象的 port token。这一规则的豁免应当仅限：infrastructure 层自身的装配模块。
- **涉及文件**：见 #19、#21
- **风险**：见 #19、#21

---

## 第四轮 review 验证结果

对前几轮标记"已解决/已缓解"的所有项目进行了 2026-07-16 16:00 之后的最终验证：

| 检查项 | 结果 |
|--------|------|
| ESLint 架构规则 | ✅ 0 错误，0 警告 |
| adapters 导入 modules 实现 | ✅ 无违规 |
| adapters 导入 infrastructure 实现 | ✅ 无违规 |
| usecases 导入 infrastructure 实现 | ✅ 无违规 |
| usecases 导入 adapters | ✅ 无违规 |
| core 导入框架 | ✅ 无违规 |
| types 导入 core/infrastructure | ✅ 无违规 |
| infrastructure 反向导入 usecases/modules | ✅ 仅允许 `*.contract.ts`（transaction-runner / reference-profile-client / capability-state-reader 等） |
| Service 公开方法返回 Entity (B2) | ✅ 所有 Entity 返回方法已为 private |
| Usecase 持有 Entity (B2) | ✅ Usecase 无 Entity import |
| QueryService mapper 接受 Entity (B2) | ✅ 已改为仅接受 Snapshot |
| Guard info 参数 (B1) | ✅ JwtAuthGuard / OptionalJwtAuthGuard 均处理 info |
| Filter 生产环境错误分类 (B1) | ✅ 生产环境仅保留大类错误码 |
| Resolver 编排多 Usecase (B3) | ✅ 每个 Resolver 方法仅调用单一 Usecase |
| Resolver catch 吞异常 (B4) | ✅ 无 try-catch 模式 |
| Capability ID 与决策一致性 (B5) | ✅ 所有 Capability ID 均在 current.md 中声明 |
| types 层无运行时副作用 (B6) | ✅ 无 reflect-metadata/框架 import |
| types 层无 framework 常量 (B6) | ✅ bullmq.types.ts 已移除 |
| types 层无 infrastructure re-export (B6) | ✅ transaction.types.ts 已修复 |
| modules 层无 HttpService (B7) | ✅ 无 HttpService import |
| 同域接口重复 (B7) | ✅ ThirdPartyProvider 仅在 contracts/ 定义 |
| 死代码 (B7) | ⚠️ TypeOrmPaginationModule / TypeOrmSearchModule / SearchModule 进入死代码（#19/#21） |
| 硬编码 URL (B8) | ✅ 已提取为命名常量 |
| 硬编码 timeout (B8) | ✅ 无违规 |
| Filter 单测覆盖 (B9) | ✅ 关键分支已覆盖 |
| maskEmail 重复 | ✅ 已提取到 core/common/text/text.helper.ts |
| capability-bus 残留 (B5) | ✅ 已完全移除，CAPABILITY_QUERY_BUS 全项目无引用 |
| modules 层持有具体 infrastructure 实现 (B7 扩展) | ❌ 见 #22：pagination.module.ts / search.module.ts |
| PAGINATION_TOKENS 双份定义 | ❌ 见 #20 |
| TypeOrmPaginationModule 死代码 | ❌ 见 #19 |
| SearchModule 死代码 | ❌ 见 #21 |

---

## 总结

| 状态 | 数量 | 编号 |
|------|------|------|
| 已解决 | 3 | 上一轮 #3、#15、#16 最终确认 |
| 未解决（新发现） | 4 | #19, #20, #21, #22 |
| **合计未解决** | **4** | 本轮新发现的 modules 层做 infrastructure 装配的同源问题 |

### 核心问题归纳

本轮 4 个未解决问题本质上是**同一类反模式的不同表现**：

- **反模式**：`src/modules/common/` 下的 `pagination.module.ts` / `search.module.ts` 在 modules 层执行 infrastructure 职责（DI 装配具体类），同时引入了：
  1. 镜像重复（`TypeOrmPaginationModule` / `TypeOrmSearchModule` 被旁路）
  2. 重复 token 定义（`PAGINATION_TOKENS` 双份）
  3. 死代码（被旁路的 `TypeOrm*Module` + 未被使用的 `SearchModule`）

### 推荐修复顺序

1. **第一步（消除死代码，最小风险）**：删除 `src/modules/common/search.module.ts`（#21）。零引用方、零依赖。
2. **第二步（消除 token 重复）**：删除 `src/modules/common/tokens/pagination.tokens.ts`，迁移 `pagination.module.ts` / `pagination.query.service.ts` 到 `@core/pagination/pagination.tokens`（#20）。
3. **第三步（消除镜像装配）**：重构 `pagination.module.ts` 为 `imports: [TypeOrmPaginationModule]` + 仅 `PaginationQueryService` provider（#19）；评估 `TypeOrmPaginationModule` 是否仍保留。
4. **第四步（长期 ESLint 加固）**：新增 `no-modules-to-infrastructure-concrete-imports` 规则（#22），防止此类反模式再次出现。

### 涉及文件（本轮全部）

- `src/modules/common/pagination.module.ts`（重构）
- `src/modules/common/pagination.query.service.ts`（改 import）
- `src/modules/common/tokens/pagination.tokens.ts`（删除）
- `src/modules/common/search.module.ts`（删除）
- `src/infrastructure/typeorm/pagination/typeorm-pagination.module.ts`（评估删除/保留）
- `src/infrastructure/typeorm/search/typeorm-search.module.ts`（评估删除）
- `src/infrastructure/typeorm/search/typeorm-search.ts`（评估删除）
- `src/modules/blog/blog.module.ts`（确认 imports 路径）
- `src/core/pagination/pagination.tokens.ts`（作为唯一真源保留）
- `eslint.config.mjs`（新增规则 #22 长期项）

---

## 结构化问题评估报告

> 审核日期：2026-07-16
> 审核依据：`docs/common/modules.rules.md`、`docs/common/infrastructure.rules.md`、`docs/common/type.rules.md`、`docs/common/core.rules.md`、`docs/common/eslint-architecture-rules.md`、`docs/common/modules.extra.rules.md`、`docs/common/queryservice.rules.md`、`docs/common/boundary-contract.rules.md`
> 审核方法：逐条对照项目规范原文 + 实际代码验证（grep / 文件读取），确认问题描述的准确性，评估严重程度与修复必要性。

### 一、问题描述准确性验证

| # | 原描述核心断言 | 验证结果 | 偏差说明 |
|---|---------------|---------|---------|
| 19 | `PaginationModule` 直接 import 3 个具体基础设施类 | ✅ 准确 | `pagination.module.ts` 第 10-12 行确实 import `HmacCursorSigner`、`TypeOrmPaginator`、`TypeOrmSort` |
| 19 | `TypeOrmPaginationModule` 仅有定义处引用（死代码） | ✅ 准确 | `grep TypeOrmPaginationModule src/` 仅命中 `typeorm-pagination.module.ts:37` 定义行 |
| 19 | `PaginationModule` 被 `blog.module.ts` 实际引用 | ✅ 准确 | `blog.module.ts:49` 的 `imports` 包含 `PaginationModule` |
| 19 | 规范依据 "modules 层的 module.ts DI 装配应委托给 infrastructure 装配模块" | ⚠️ 需修正 | `modules.rules.md` 原文并无此措辞。原文允许 "modules(service) → infrastructure"（依赖方向一节），且 modules.extra.rules.md 仅说 "统一使用 PaginationService"，未要求 DI 装配必须委托给 infrastructure 模块。**此条规范依据引用不准确** |
| 20 | core 和 modules/common/tokens 各有一份 `PAGINATION_TOKENS` | ✅ 准确 | 两个文件内容完全一致，Symbol 不同 |
| 20 | 引用关系：core ← infrastructure、modules/common/tokens ← pagination.module + pagination.query.service | ✅ 准确 | 验证通过 |
| 21 | `SearchModule` / `SearchService` 全项目无引用方 | ✅ 准确 | `grep 'from.*search.module'` 无命中；`SearchModule`/`SearchService` 仅在定义文件内出现 |
| 21 | `TypeOrmSearchModule` 也仅定义处引用 | ✅ 准确 | `grep TypeOrmSearchModule src/` 仅命中定义行 |
| 22 | modules 层 `pagination.module.ts` / `search.module.ts` 直接 import 具体实现类 | ✅ 准确 | 但原描述称 "仅 2 处命中"，实际验证 `grep -rn "from '@src/infrastructure/" src/modules/ | grep -v ".contract.ts"` 返回 **74 行**，包含大量 `getTypeOrmEntityManager`、`BullMqModule`、`CapabilityAnchorProvider` 等。**原描述的"仅 2 处"不准确**——modules → infrastructure 具体类 import 是项目广泛存在的模式 |

### 二、逐条评估与分类

---

#### #19：PaginationModule 镜像重复 TypeOrmPaginationModule

**分类：已修复** — `TypeOrmPaginationModule` 死代码已删除；`PAGINATION_TOKENS` 已统一到 core 唯一真源（#20）；`PaginationModule` 的 DI 装配模式符合规范，保留现状。

**评估理由**：

1. **规范符合性**：
   - `modules.rules.md` 明确允许 `modules(service) → infrastructure`（"允许内容"一节："通用能力模块化。通过 DI token 绑定 infrastructure 实现。"；"依赖方向"一节："允许 modules(service) → infrastructure | core"）。
   - `PaginationModule` 在 modules 层进行 DI 装配并绑定 infrastructure 实现，**符合当前项目规范**。
   - 原描述引用的 "modules 层的 module.ts DI 装配应委托给 infrastructure 装配模块" 在 `modules.rules.md` 中**不存在此措辞**。这是一条被误读的规范依据。

2. **镜像重复的真实性质**：
   - `PaginationModule` 与 `TypeOrmPaginationModule` 的差异不仅是位置不同，更重要的是职责不同：
     - `TypeOrmPaginationModule`（infrastructure）：纯 DI 装配模块，仅提供 `PAGINATOR` / `CURSOR_SIGNER` / `DEFAULT_SORT_RESOLVER` 三个 provider。
     - `PaginationModule`（modules/common）：**聚合了基础设施装配 + 业务 QueryService**（`PaginationQueryService`），是对外暴露的统一模块入口。
   - 这与项目中其他模式一致：`BlogModule`、`AuthModule`、`AccountModule` 等业务域模块同样在 module.ts 中聚合 service + infrastructure 装配。
   - `PaginationModule` 存在的理由：`PaginationQueryService` 归属 modules 层（按 `queryservice.rules.md`），需要一个 NestJS Module 来注册它，同时必须保证其 `IPaginator` 依赖被满足——因此在同一 Module 中提供装配是自然选择。

3. **TypeOrmPaginationModule 死代码**：
   - 确实无外部引用方。但删除它需要先确认 `PaginationModule` 已完整替代其职责（已确认）。
   - 死代码清理属于代码卫生，不阻塞功能，可延后处理。

4. **可替换性**：
   - 原描述称"切换分页实现需要同时修改两处"。但由于 `TypeOrmPaginationModule` 已无引用方，实际只需修改 `PaginationModule` 一处。不存在双维护点问题。

5. **修复风险**：
   - 原描述的"方案 A"（改为 `imports: [TypeOrmPaginationModule]`）存在 token 不兼容风险：两份 `PAGINATION_TOKENS` 是不同的 Symbol 对象，切换后 DI 容器无法匹配。需要同步修改 `PaginationQueryService` 的 `@Inject` 来源。这增加了修改面和回归风险。
   - 当前实现可正常工作，不阻塞任何功能或架构目标。

**结论**：当前实现符合项目规范，镜像重复的性质是"同一模块内聚合基础设施装配 + 业务服务"这一被项目广泛使用的模式。`TypeOrmPaginationModule` 死代码应清理，但不紧急。修复可在下次涉及 pagination 模块的重构时顺带完成。

**优先级**：P3（可延后）
**规范依据（修正）**：`modules.rules.md` 允许 modules → infrastructure；`modules.extra.rules.md` 要求统一分页服务（已满足）；`type.rules.md` 单一真源（token 重复属 #20 范畴）
**修复触发条件**：下次修改 pagination 相关代码时，或项目启动死代码清理专项时

---

#### #20：PAGINATION_TOKENS 双份定义

**分类：已修复** — `modules/common/tokens/pagination.tokens.ts` 已删除；`pagination.module.ts` 和 `pagination.query.service.ts` 已切换为 `@core/pagination/pagination.tokens`。

**评估理由**：

1. **规范符合性**：
   - `type.rules.md` 明确要求"单一真源：同一业务语义只允许一个权威定义"。
   - 两份 `PAGINATION_TOKENS` 定义了语义完全相同的 DI token，但使用了不同的 Symbol 对象（`Symbol('PAGINATOR') !== Symbol('PAGINATOR')`），这在技术上构成两个独立的 token。
   - **违反了 type.rules.md 的单一真源原则**。

2. **实际影响**：
   - 当前 `PaginationModule`（使用 modules/common/tokens 的 PAGINATION_TOKENS）和 `TypeOrmPaginationModule`（使用 core 的 PAGINATION_TOKENS）使用不同的 token 向 DI 容器注册。这意味着如果两者同时被 import（虽然当前不会发生），将产生两个独立的 `PAGINATOR` provider。
   - 更重要的是，若未来要重构 `PaginationModule` 引用 `TypeOrmPaginationModule` 的装配，token 不兼容是直接阻碍。
   - 新开发者阅读代码时会产生困惑：两份同名但不同的 token 定义，应使用哪一份？

3. **修复风险**：
   - 低——仅需修改 2 个文件的 import 路径（`pagination.module.ts` 和 `pagination.query.service.ts`），将 `PAGINATION_TOKENS` 来源从 `./tokens/pagination.tokens` 改为 `@core/pagination/pagination.tokens`，然后删除 `modules/common/tokens/pagination.tokens.ts`。
   - 由于 `PaginationModule` 当前是 `PAGINATION_TOKENS.PAGINATOR` 的唯一注册方，切换 token 来源后 DI 行为不变（`@Inject` 和 `provide` 使用同一个 Symbol）。

**结论**：明确违反单一真源原则，修复成本低、风险低、收益明确。应在近期修复。

**优先级**：P2（近期修复）
**规范依据**：`docs/common/type.rules.md` §1 "单一真源：同一业务语义只允许一个权威定义"
**修复方案**：
1. `pagination.module.ts` 和 `pagination.query.service.ts` 改 import 为 `@core/pagination/pagination.tokens`
2. 删除 `src/modules/common/tokens/pagination.tokens.ts`
3. 运行单测验证

---

#### #21：SearchModule 死代码

**分类：已修复** — `search.module.ts`、`typeorm-search.module.ts`、`typeorm-search.ts`、`search.e2e-spec.ts` 已删除。

**评估理由**：

1. **规范符合性**：
   - 项目无明确的"死代码必须立即删除"规范，但代码卫生的最佳实践要求清除无引用方的代码。
   - `SearchModule` 和 `SearchService` 全项目无任何引用方，且 `TypeOrmSearchModule` 也仅定义处引用。

2. **死代码 vs 预留能力**：
   - 原描述称 search 能力"已被 PaginationQueryService 替代"。经验证，`PaginationQueryService` 仅处理分页，不包含全文搜索功能。SearchModule 是**预留但未启用**的独立搜索能力，而非"被旁路"的死代码。
   - 但无论其性质是"预留"还是"废弃"，当前无人引用是客观事实。预留能力应通过 git 历史可追溯，无需保留在代码库中增加维护负担。

3. **修复风险**：
   - 极低——删除 `search.module.ts` 不影响任何现有功能。`TypeOrmSearchModule` 和 `TypeOrmSearch` 的去留可单独评估。

**结论**：死代码清理，风险极低。应删除以保持代码库整洁。

**优先级**：P2（近期修复，与 #20 同步进行）
**规范依据**：代码卫生最佳实践；无引用方 = 无生产价值
**修复方案**：
1. 删除 `src/modules/common/search.module.ts`
2. 评估 `src/infrastructure/typeorm/search/` 整个子树是否也可删除

---

#### #22：modules 层持有具体基础设施实现类

**分类：无需修复**

**评估理由**：

1. **规范符合性**：
   - `modules.rules.md` "允许内容"一节明确写道："通用能力模块化。通过 DI token 绑定 infrastructure 实现。"
   - `modules.rules.md` "依赖方向"一节明确写道："允许 modules(service) → infrastructure | core。"
   - `modules.rules.md` "允许内容"还写道："Module 级 provider factory 可读取 ConfigService，用于把运行时配置归一化为本模块内部 options token。"
   - `eslint-architecture-rules.md` 中 `boundaries/dependencies` 规则的 layer matrix 明确允许 `modules -> same-domain/common/core/types/infrastructure`。
   - **modules 层 import infrastructure 具体实现类是项目架构的合法设计选择，不是反模式。**

2. **原描述的 "仅 2 处命中" 严重不准确**：
   - 实际验证 `grep -rn "from '@src/infrastructure/" src/modules/ | grep -v ".contract.ts"` 返回 **74 行**，包含：
     - `getTypeOrmEntityManager`（约 15 处）—— modules 层在事务上下文中解包 EntityManager
     - `BullMqModule`、`BullMqProducerGateway`、`BULLMQ_JOBS`/`BULLMQ_QUEUES`（约 10 处）—— 消息队列基础设施
     - `CapabilityAnchorProvider`、`CapabilityRuntimeContributionProvider`（约 8 处）—— 能力装饰器
     - `CoreJwtModule`、`FieldEncryptionModule`、`BlogStorageModule`、`ThirdPartyAuthInfrastructureModule`、`AiInfrastructureModule`（约 5 处）—— 业务域 infrastructure 装配模块
     - `DirectReferenceProfileClient`（1 处）—— 能力客户端实现
     - `HmacCursorSigner`、`TypeOrmPaginator`、`TypeOrmSort`（3 处）—— 分页基础设施
     - `TypeOrmSearch`（1 处）—— 搜索基础设施
   - 如果 #22 的逻辑成立（modules 不应 import infrastructure 具体类），则上述 74 处均需改造。这与项目当前架构设计相矛盾。

3. **ESLint 规则建议的合理性**：
   - 原描述建议新增 `no-modules-to-infrastructure-concrete-imports` 规则。但鉴于上述 74 处合法引用，该规则将需要大量豁免配置，且与 `boundaries/dependencies` 规则的现有 layer matrix 矛盾。
   - 项目通过 `boundaries/dependencies` + `no-infrastructure-to-modules-imports`（反向）来控制层间依赖方向，已经足够。modules → infrastructure 是允许的方向。

4. **与 #19 的关系**：
   - #22 的问题本质是 #19 的子集（pagination.module.ts 的 3 处 import）。既然 #19 已被分类为"可延后修复"（且主要是死代码清理），#22 作为其 B7 维度条目，无需独立修复。

**结论**：modules → infrastructure 具体类 import 是项目架构的合法设计选择，被规范明确允许，被 ESLint 验证通过，且在项目中有 74 处广泛使用。#22 描述的"反模式"判断基于对规范的误读，不成立。

**优先级**：无需修复
**判断理由**：`modules.rules.md` 允许 modules → infrastructure；ESLint `boundaries/dependencies` 允许；74 处项目广泛使用

---

### 三、分类汇总

| 分类 | 编号 | 优先级 | 说明 |
|------|------|--------|------|
| **需修复** | #20 | P2 | PAGINATION_TOKENS 双份定义，违反单一真源原则。修复成本低、风险低 |
| **需修复** | #21 | P2 | SearchModule 死代码，无引用方。修复风险极低 |
| **可延后修复** | #19 | P3 | PaginationModule 镜像重复。当前实现符合规范，TypeOrmPaginationModule 死代码可延后清理 |
| **无需修复** | #22 | — | modules → infrastructure 具体类 import 是项目合法设计选择，被规范明确允许 |

### 四、修复执行建议

#### 立即可做（P2）

1. **#20 — 统一 PAGINATION_TOKENS 到 core 唯一真源**
   - 步骤：
     1. 修改 `src/modules/common/pagination.module.ts` 第 8 行：`import { PAGINATION_TOKENS } from '@core/pagination/pagination.tokens';`
     2. 修改 `src/modules/common/pagination.query.service.ts` 第 19 行：`import { PAGINATION_TOKENS } from '@core/pagination/pagination.tokens';`
     3. 删除 `src/modules/common/tokens/pagination.tokens.ts`
     4. 运行 `npx eslint src/modules/common/pagination.module.ts src/modules/common/pagination.query.service.ts` 验证
     5. 运行相关单测
   - 风险：低（切换后 `provide` 和 `@Inject` 使用同一个 Symbol，DI 行为不变）

2. **#21 — 删除 SearchModule 死代码**
   - 步骤：
     1. 删除 `src/modules/common/search.module.ts`
     2. 评估 `src/infrastructure/typeorm/search/` 子树是否也可删除（`TypeOrmSearch`、`TypeOrmSearchModule` 均无引用方）
     3. 如保留 `typeorm/search/` 作为预留能力，需在文件头注释标明 "预留能力，暂无生产引用方"
   - 风险：极低

#### 延后处理（P3）

3. **#19 — TypeOrmPaginationModule 死代码清理**
   - 触发条件：下次修改 pagination 相关代码，或项目启动死代码清理专项
   - 步骤：
     1. 确认 `PaginationModule` 已完整替代 `TypeOrmPaginationModule` 的职责（已确认）
     2. 删除 `src/infrastructure/typeorm/pagination/typeorm-pagination.module.ts`
     3. 运行全量 lint + 单测
   - 注意：删除后 `core/pagination/pagination.tokens.ts` 的唯一引用方变为 `PaginationModule`（modules 层），这是允许的依赖方向

#### 无需修复

4. **#22 — modules → infrastructure 具体类 import**
   - 不修复。这是项目架构的合法设计选择。
   - 原描述中 "仅 2 处命中" 的断言不准确（实际 74 处），建议的 ESLint 规则与现有架构矛盾。

### 五、规范依据修正记录

| # | 原引用规范 | 修正内容 |
|---|-----------|---------|
| 19 | "modules 层的 module.ts DI 装配应委托给 infrastructure 装配模块" | `modules.rules.md` 无此措辞。原文允许 "通用能力模块化，通过 DI token 绑定 infrastructure 实现"。此条依据应删除或改为"设计偏好" |
| 22 | "modules 层持有具体基础设施实现类是结构性反模式" | `modules.rules.md` 允许 modules → infrastructure；ESlint `boundaries/dependencies` 允许。此条不是反模式，是合法设计选择 |
