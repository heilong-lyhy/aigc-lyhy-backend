# 全局架构检查计划

> 生成时间：2026-07-15
> 目标：系统性执行项目全局架构检查，覆盖 import 级依赖方向 + 方法体语义级深审，确保不遗漏任何盲区

---

## 执行进度

| 步骤 | 名称 | 状态 |
|------|------|------|
| 第一步 | 阅读规范文档与审计盲区报告 | ✅ 已完成 |
| 第二步 | 全局 review 层规范和依赖方向 | ✅ 已完成 |
| 第三步 | 检查项目中是否存在同样功能的二次实现情况 | ✅ 已完成 |
| 第四步 | 检查项目代码是否存在偏离或违反 docs 中规范的情况 | ✅ 已完成 |

---

## 第一步：阅读规范文档与审计盲区报告

**目标**：建立完整的规范认知 + 审计盲区认知，确保后续判断有据可依且不遗漏盲区。

**执行方式**：

1. 系统阅读后端 `docs/` 目录下的所有规范文件：
   - `docs/common/type.rules.md` — 类型管理、四层类型模型、import 方向
   - `docs/common/boundary-contract.rules.md` — 边界契约归属、*.contract.ts 命名
   - `docs/common/entity.rules.md` — ORM Entity 纯净性
   - `docs/common/modules.rules.md` — modules 职责、依赖方向、禁止跨域依赖
   - `docs/common/usecase.rules.md` — Usecase 编排、事务边界
   - `docs/common/queryservice.rules.md` — QueryService 只读语义
   - `docs/common/aggregate.rules.md` — 聚合根写入口
   - `docs/common/capability.rules.md` — Capability 语义边界
   - `docs/common/capability-plugin.rules.md` — Capability 插件系统
   - `docs/common/core.rules.md` — Core 层纯净性
   - `docs/common/infrastructure.rules.md` — Infrastructure 层职责
   - `docs/common/eslint-architecture-rules.md` — ESLint 架构规则
   - `docs/api/adapters.rules.md` — Adapter 层职责与边界
   - `docs/worker/worker-adapter.rules.md` — Worker Adapter 依赖方向
   - `docs/worker/worker-usecase.rules.md` — Worker Usecase 约束

2. 重点研读审计盲区报告 `docs/audit_reports/method_audit_blind_spots.md`，理解 9 类盲区（B1-B9）及其检查规程

3. 阅读 `docs/capabilities/current.md`，理解当前 Capability 决策

4. 阅读 `plans/README.md`，理解当前治理计划

**预期成果**：建立规范认知 + 盲区认知双重框架。

---

## 第二步：全局 review 层规范和依赖方向

**目标**：检查项目分层结构是否符合规范，依赖方向是否正确。

**执行方式**：

### 2.1 ESLint 架构规则检查

```bash
npx eslint "{src,apps,libs,test}/**/*.ts" --cache
```

### 2.2 import 级依赖方向检查

| 检查项 | 检查方法 | 预期结果 |
|--------|---------|---------|
| adapters 导入 modules/service 实现 | grep `from '@src/modules/'` in `src/adapters/` | 仅允许 import type 引用 bounded context 根 *.types.ts |
| adapters 导入 infrastructure 实现 | grep `from '@src/infrastructure/'` in `src/adapters/` | Worker adapter 仅允许 queue runtime contracts / DTO |
| usecases 导入 infrastructure | grep `from '@src/infrastructure/'` in `src/usecases/` | 仅 spec 文件宽松，实现文件禁止 |
| usecases 导入 adapters | grep `from '@src/adapters/'` in `src/usecases/` | 禁止 |
| modules 依赖其他业务域 modules | 检查各业务域 import | 禁止跨域直接依赖 |
| core 导入框架/上游层 | grep `from '@nestjs/'` etc. in `src/core/` | 禁止 |
| types 导入 core | grep `from '@core/'` or `from '@src/core/'` in `src/types/` | 禁止 |
| infrastructure 反向导入 usecases/modules 实现 | grep in `src/infrastructure/` | 仅允许 *.contract.ts |

### 2.3 方法体语义级依赖方向检查（盲区 B2）

| 检查项 | 检查方法 | 预期结果 |
|--------|---------|---------|
| Service 公开方法返回 Entity | grep `Promise<.*Entity>` in `src/modules/**/*.service.ts` | Service 对上游应返回 View/snapshot/data shape，不应暴露 Entity |
| Usecase 持有并操作 Entity 字段 | 追踪 Usecase 调用链，检查是否读取 Entity 字段 | Usecase 不得 import 或短暂持有 ORM Entity |
| QueryService mapper 参数接受 Entity | 检查 `toDetailView` 等方法参数类型 | QueryService 对外不得以 Entity 作为映射参数契约 |

**预期成果**：所有分层依赖方向违规被识别并记录。

---

## 第三步：检查项目中是否存在同样功能的二次实现情况

**目标**：识别同功能二次实现，确保单一真源。

**执行方式**：

### 3.1 同域接口/类型重复定义

- 扫描每个业务域目录下的 `interfaces/` 和 `contracts/`，检查是否有同名接口/类型
- 特别关注 `ThirdPartyProvider` 在 `interfaces/` vs `contracts/` 的重复

### 3.2 同功能 Service/Helper 重复实现

- 扫描 `src/modules/common/` 下不同 service 中的同名私有方法（如 `maskEmail`）
- 扫描 `src/core/common/` 下是否有应抽取但未抽取的通用逻辑

### 3.3 死代码/已废弃实现

- 检查 `src/modules/` 中是否有已被 infrastructure 层替代的实现（如 `WeAppProvider` vs `WeAppHttpProvider`）
- 检查 `src/usecases/common/ports/capability-bus.contract.ts` 是否仍被使用
- 检查 `src/modules/reference/reference-report.capability.ts` 是否与决策一致

### 3.4 Capability ID 定义重复

- 检查 Capability ID 是否由 Anchor 单一定义，其他位置是否用字面量
- 检查是否有多个文件定义同一 Capability ID

**预期成果**：所有同功能二次实现被识别并记录。

---

## 第四步：检查项目代码是否存在偏离或违反 docs 中规范的情况

**目标**：识别所有偏离 docs 规范的代码，覆盖方法体语义级盲区。

**执行方式**：

### 4.1 运行时行为语义违规（盲区 B1）

| 检查项 | 检查方法 | 规范依据 |
|--------|---------|---------|
| Guard info 参数忽略 | 逐文件阅读 `src/adapters/api/graphql/guards/*.guard.ts`，确认 handleRequest 是否处理 info 参数 | 全局认证契约 |
| Filter 生产环境错误分类 | 逐文件阅读 `src/infrastructure/graphql/filters/*.filter.ts`，确认 isProdEnv 分支 | 全局错误契约：401→UNAUTHENTICATED, 403→FORBIDDEN |

### 4.2 Adapter 内编排/授权违规（盲区 B3）

| 检查项 | 检查方法 | 规范依据 |
|--------|---------|---------|
| Resolver 编排多 Usecase | 统计每个 Resolver 方法内 Usecase 调用次数 | `docs/api/adapters.rules.md` — Adapter 只做薄映射 |
| Resolver 内授权决策 | 检查 Resolver 条件分支是否做权限/敏感输出判断 | Adapter 不应做流程级授权决策 |

### 4.3 异常处理策略违规（盲区 B4）

| 检查项 | 检查方法 | 规范依据 |
|--------|---------|---------|
| Resolver catch 吞 DomainError | grep `catch` + `return { success: false` in `src/adapters/` | 全局错误契约：DomainError 应冒泡到 Filter |
| 错误消息泄露 | 检查 catch 中 `error.message` 是否直接暴露给客户端 | 安全规则 |

### 4.4 架构决策一致性违规（盲区 B5）

| 检查项 | 检查方法 | 规范依据 |
|--------|---------|---------|
| Capability bus/queue 遗留 | 检查 `capability-bus.contract.ts` + `queue-registry.ts` CAPABILITY 队列 | `docs/capabilities/current.md` |
| reference.report Anchor | 检查 `reference-report.capability.ts` 是否与决策一致 | Capability 决策 |

### 4.5 types 层内容语义违规（盲区 B6）

| 检查项 | 检查方法 | 规范依据 |
|--------|---------|---------|
| types 运行时副作用 | grep `import '` in `src/types/` | `docs/common/type.rules.md` — types 应无框架运行时副作用 |
| types framework 常量 | 检查 types 文件是否承载 BullMQ/NestJS 常量 | types 应为稳定无框架契约 |
| types 单流程类型 | 检查 types 文件使用者是否仅限单个流程 | 应 collocate |

### 4.6 硬编码配置违规（盲区 B8）

| 检查项 | 检查方法 | 规范依据 |
|--------|---------|---------|
| URL 硬编码 | grep `https?://` in `src/infrastructure/` | 应通过 ConfigService/options token 注入 |
| timeout 硬编码 | grep `timeout:\s*\d+` in `src/infrastructure/` | 应通过配置注入 |

### 4.7 单测覆盖盲区（盲区 B9）

| 检查项 | 检查方法 | 规范依据 |
|--------|---------|---------|
| Filter 分支未覆盖 | 对照 filter 实现条件分支，检查 spec 文件 | 关键路径应有单测覆盖 |

**预期成果**：所有偏离 docs 规范的代码被识别并记录。

---

## 输出格式

所有发现的问题整理后放入 `plans/Lingeringissue/` 目录，文件命名格式与现有文件保持一致（`question{date}.md`），内容格式参照 `question26-07-13.md`，包含：
- 问题编号与标题
- 状态标记：[未解决] / [已解决]
- 规范依据
- 现状描述
- 影响评估
- 修复方案
- 涉及文件
- 风险评估
