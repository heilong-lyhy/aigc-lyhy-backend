# 问题：策略一回退后 README/docs 仍引用已删除的 capability:* npm scripts - 2026-07-22

## 状态：[已解决 2026-07-22]

## 修复决策与执行

**决策**：采用方案 A 的精修版本（追加注解 + 局部改写，不删除规范文档）。

**理由**：策略一保留了 Capability 系统核心（21 个 `*.capability.ts` 文件仍在工作），规范文档仍是业务代码的依据，不能删除。用户回退目的是"减少 AI 生成代码时的约束"，不是"消灭 Capability"。删除的只是 CLI 观察工具，规范本身有效。

**精修策略**：
- 操作类指引（README 命令列表）→ 删除失效命令
- 概念类描述（rules.md "Human Observation Window"）→ 改写为"通过源码观察"+ 注解说明 CLI 已移除
- 历史文档（audit_reports/plans）→ 不动

**修复执行**：

| 文件 | 修改内容 |
|---|---|
| `README.md` 第 185 行 | "本地观察"段改写为"阅读 `*.capability.ts` + `docs/generated/capabilities-current.md`"，追加策略一回退注解 |
| `README.md` 第 261-265 行 | "测试与开发命令"段落删除 3 条 `npm run capability:*` 失效命令 |
| `docs/common/capability.rules.md` 第 145-157 行 | "Human Observation Window" 整段改写为源码驱动观察方式，保留语义决策参考，追加 Note 注解 CLI 已移除 |
| `docs/common/capability-plugin-authoring.guide.md` 第 63 行 | 改写为"阅读 `*.capability.ts` 与 generated docs"，追加 commit `5235d79` 注解 |

## 规范依据

- `plans/check/global-architecture-check.md` 第四步 4.4 架构决策一致性违规（B5）
- `docs/README.md` 项目根 README 的"测试与开发命令"应与 `package.json` scripts 保持一致
- `docs/common/capability.rules.md` 规范文档中的操作指引应可执行

## 现状描述

2026-07-22 执行策略一回退（commit `5235d79`）后，`package.json` 已移除以下 npm scripts：
- `capability:list`
- `capability:docs`
- `capability:docs:check`
- `lint:architecture-fixtures`

但下列文件**仍引用这些已不存在的命令**，导致用户/AI 按文档操作时会遇到 `Missing script: "capability:list"` 错误：

| 文件 | 行号 | 失效引用 |
|---|---|---|
| [README.md](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/README.md) | 185 | `npm run capability:list` / `capability:docs` / `capability:docs:check` |
| [README.md](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/README.md) | 261-265 | "查看当前 capability id..." 段落三条命令 |
| [docs/common/capability.rules.md](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/docs/common/capability.rules.md) | 147 | `npm run capability:list is the single interactive view` |
| [docs/common/capability.rules.md](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/docs/common/capability.rules.md) | 159 | `npm run capability:docs` / `capability:docs:check` |
| [docs/common/capability-plugin-authoring.guide.md](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/docs/common/capability-plugin-authoring.guide.md) | 63 | `npm run capability:list gives a useful shallow view` |

**注**：以下文件虽也引用，但属历史记录/规划文档，**不应改动**：
- `docs/audit_reports/method_audit_blind_spots.md` — 审计报告，记录历史事实
- `plans/capability-plugin-followup.md` — 历史规划文档
- `plans/Lingeringissue/question26-07-20.md` — 本次回退的规划文档

## 影响评估

| 维度 | 影响 |
|---|---|
| 构建 | 无影响（`prebuild:api` 已移除 `capability:docs:check` 调用） |
| 测试 | 无影响（`test` 不调用 capability 脚本） |
| lint | 无影响（`lint` 已移除 `capability:docs:check && lint:architecture-fixtures`） |
| 类型检查 | 无影响（`typecheck` 已移除 `tsconfig.tools.json`） |
| 运行时 | 无影响（业务代码未变，jest 102 suites / 730 tests 全通过） |
| **用户体验** | **中**：按 README 跑 `npm run capability:list` 会失败 |
| **AI 适配** | **中**：AI 读 docs 会被误导，认为可通过此命令观察能力清单 |
| **策略一目标** | **部分受挫**：策略一目的是让 AI 不受 capability 规则约束，但 docs 仍指引 AI 去用 capability 工具 |

## 修复方案

### 方案 A：补全 docs/README 中的说明（推荐，最小改动）

在 README.md 和 docs/common/capability.rules.md 的相关段落**追加一行说明**，不删除原内容（保留历史信息）：

```markdown
> 注：`capability:list/docs/docs:check` 脚本已在策略一回退（commit 5235d79, 2026-07-22）中移除。
> 如需恢复，参见 `plans/Lingeringissue/question26-07-20.md` 的策略二/三。
```

**优点**：
- 修改最小（3 个文件各加 1-2 行）
- 保留历史信息，便于未来恢复
- 用户/AI 一眼看出"此命令已不可用"

**缺点**：
- 原命令描述仍在文档中，AI 仍可能引用（但会被注解拦截）

### 方案 B：删除失效引用（更彻底）

从 README.md 和 docs/common/capability.rules.md 中**删除**所有 `npm run capability:*` 的指引段落。

**优点**：
- 文档与代码完全一致
- AI 不会再读到这些命令

**缺点**：
- 丢失历史信息
- 若未来恢复 capability 工具链，需重新补回

### 方案 C：恢复 npm scripts（不推荐）

把 `capability:list/docs/docs:check` 脚本加回 `package.json`，但**不**恢复 `scripts/capability-list.ts`（脚本会因找不到实现文件而失败）。

**不推荐**：会造成"脚本存在但执行失败"的更坏状态。

## 涉及文件

- [README.md](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/README.md) — 第 185, 261-265 行
- [docs/common/capability.rules.md](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/docs/common/capability.rules.md) — 第 147, 159 行
- [docs/common/capability-plugin-authoring.guide.md](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/docs/common/capability-plugin-authoring.guide.md) — 第 63 行

## 风险评估

- **修复风险**：低。只动文档，不动代码，不影响构建/测试/运行
- **不修复风险**：中。AI 适配性改善打折扣（策略一核心目标受损），用户体验下降
- **回滚风险**：无。文档改动可随时通过 git revert 恢复

## 验证

修复后执行：
```bash
# 确认无残留失效引用（排除历史/规划文档）
grep -rn 'npm run capability:' README.md docs/common/capability*.md
# 应只返回注解说明，无"可直接运行"的指引
```

## 关联

- 回退规划文档：[question26-07-20.md](file:///home/heilong_lyhy/aigc/aigc-friendly-backend/plans/Lingeringissue/question26-07-20.md)
- 回退 commit：`5235d79`
- 本次全局检查触发：`plans/check/global-architecture-check.md` 第四步 4.4
