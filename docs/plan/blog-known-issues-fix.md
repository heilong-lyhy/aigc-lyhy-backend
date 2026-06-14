# Blog 已知问题修复计划（后端部分）

> 创建时间：2026-06-14
> 状态：执行中

---

## 问题总览

| # | 问题 | 优先级 | 根因 | 影响范围 |
|---|------|--------|------|----------|
| 1 | 非 mahiru 的 ADMIN 账户无法使用 Blog Admin | P1 | 需排查 `userInfo` query 是否对所有 ADMIN 账户正确返回 `accessGroup` | Blog Admin 全部管理功能 |
| 2 | 文件管理无法上传文件 | P1 | 需验证 `graphql-upload` 中间件是否正常加载；`storedName` 使用原始文件名可能有问题 | 文件上传 |
| 3 | 置顶功能仅在 Blog Admin | P2 | 后端排序已正确，无需修改 | - |
| 4 | 回收站无法正常运作 | P1 | 前端问题，后端 `blogDeletedPosts` query 已存在且正确 | - |
| 5 | 点赞无账号划分 | P1 | `toggleBlogPostLike` resolver 未从 JWT 获取用户 ID，完全信任前端传的 `userIdentifier` | 点赞功能 |
| 6 | Blog Admin 仍在 labs 区（前端） | P1 | 纯前端问题，后端无需修改 | - |

---

## 修复前必读规范文档

每个问题修复执行前，必须先阅读以下规范文档，确保修改符合项目架构约束：

### 全局必读（所有问题修复前）

| 文档 | 路径 | 核心关注点 |
|------|------|------------|
| Core 规则 | `docs/common/core.rules.md` | 领域模型纯度、boundary contract 归属、禁止框架代码 |
| Modules(service) 规则 | `docs/common/modules.rules.md` | 读写分离、事务边界、QueryService 职责、禁止跨域依赖 |
| Usecase 规则 | `docs/common/usecase.rules.md` | 写操作编排、事务边界、依赖方向、错误映射 |
| Infrastructure 规则 | `docs/common/infrastructure.rules.md` | 外部依赖实现、boundary contract 实现、禁止业务规则 |
| Entity 规则 | `docs/common/entity.rules.md` | ORM Entity 纯度、禁止 adapter decorator、DTO 分离 |
| QueryService 规则 | `docs/common/queryservice.rules.md` | 读侧能力收敛、输出规范化、权限判定 |
| Adapter 规则 | `docs/api/adapters.rules.md` | 协议适配、权限守卫、DTO 规范、GraphQL 错误契约 |
| Boundary Contract 规则 | `docs/common/boundary-contract.rules.md` | boundary contract 归属、命名、TransactionRunner 口径 |

### 问题专项必读

| 问题 | 额外必读文档 | 关注点 |
|------|-------------|--------|
| 问题 1（ADMIN 权限） | `docs/common/queryservice.rules.md`（重点重读） | AccountQueryService 的 accessGroup 返回逻辑 |
| 问题 2（文件上传） | `docs/common/entity.rules.md`（重点重读）、`docs/api/adapters.rules.md`（重点重读） | Entity 与 DTO 分离、storedName 生成逻辑 |
| 问题 5（点赞账号划分） | `docs/api/adapters.rules.md`（重点重读）、`docs/common/boundary-contract.rules.md` | resolver 中 JWT 解析、boundary contract 归属 |

---

## 问题 1：非 mahiru 的 ADMIN 账户无法使用 Blog Admin

### 修复前必读

- [ ] `docs/common/queryservice.rules.md` — 确认 AccountQueryService 的 accessGroup 返回逻辑
- [ ] `docs/api/adapters.rules.md` — 确认 userInfo resolver 不限制特定账户
- [ ] `docs/common/modules.rules.md` — 确认 modules 不做跨域编排

### 根因分析

后端所有 Blog Admin mutation/query 均使用 `@Roles('ADMIN')` + `RolesGuard`，检查 JWT `accessGroup` 是否包含 `ADMIN`。逻辑本身正确。

需排查的关键点：
1. `userInfo` query 是否对非 mahiru 的 ADMIN 账户正确返回 `accessGroup`
2. 非 mahiru 账户的 `accessGroup` 在数据库中是否正确存储为 `['ADMIN']`
3. JWT 签发时是否正确包含 `accessGroup`

### 修复方案

| 文件 | 修改内容 | 规范合规说明 |
|------|----------|-------------|
| `src/modules/account/queries/account.query.service.ts` | 确认 `getFullUserInfoView` 对所有账户正确计算并返回 `accessGroup` | QueryService 负责读侧输出规范化，符合 queryservice.rules |
| `src/adapters/api/graphql/account/user-info.resolver.ts` | 确认 `userInfo` query 不限制特定账户 | Adapter 只做协议转换，不做业务规则判断，符合 adapters.rules |
| 数据库 | 确认非 mahiru 的 ADMIN 账户在 `user_info.access_group` 中存储了 `['ADMIN']` | 数据修正，不涉及代码架构 |

**规范合规注意**：
- 如果需要修改 `AccountQueryService`，确保不引入写操作（queryservice.rules: "QueryService 不产生副作用"）
- 如果需要修改 resolver，确保不在 resolver 中实现业务规则（adapters.rules: "Adapter 中实现业务规则是禁止内容"）

### 验收标准

- 非 mahiru 的 ADMIN 账户可正常调用所有 Blog Admin mutation/query
- `userInfo` query 正确返回 `accessGroup`

---

## 问题 2：文件管理无法上传文件

### 修复前必读

- [ ] `docs/common/entity.rules.md` — 确认 Entity 不混入 adapter decorator
- [ ] `docs/api/adapters.rules.md` — 确认 resolver 职责边界
- [ ] `docs/common/infrastructure.rules.md` — 确认 FileStorageAdapter 边界
- [ ] `docs/common/boundary-contract.rules.md` — 确认 FileStorageAdapter contract 归属

### 根因分析

1. **`graphql-upload` 中间件加载**：`main.ts` 使用动态导入，加载失败时仅 warn 不阻止启动，此时文件上传不可用
2. **`storedName` 使用原始文件名**：`blog-file.resolver.ts` 第 59 行 `storedName: upload.filename`，中文/特殊字符文件名可能导致存储路径问题
3. **`LocalFileStorageAdapter.saveFile`**：直接使用 `storedName` 作为文件名，无重命名策略，可能导致文件名冲突或路径注入

### 修复方案

| 文件 | 修改内容 | 规范合规说明 |
|------|----------|-------------|
| `src/adapters/api/graphql/blog/blog-file.resolver.ts` | 为 `storedName` 生成唯一文件名（如 UUID + 扩展名），避免中文/特殊字符问题 | Adapter 负责输入解析与参数组装，storedName 生成属于"入参解析"范畴，符合 adapters.rules |
| `src/infrastructure/blog-storage/local-file-storage.adapter.ts` | `saveFile` 方法添加文件名安全处理（sanitize），确保路径安全 | Infrastructure 实现 FileStorageAdapter contract，符合 infrastructure.rules |
| `src/bootstraps/api/main.ts` | `graphql-upload` 加载失败时记录更详细的错误信息，便于排查 | 基础设施初始化，符合 infrastructure.rules |

**规范合规注意**：
- `storedName` 生成逻辑放在 resolver（adapter 层）而非 usecase 层，因为这是"入参解析与参数组装"（adapters.rules: "Adapter 负责协议转换，将外部协议输入转换为用例参数"）
- 不得在 `LocalFileStorageAdapter` 中添加业务规则（infrastructure.rules: "Infrastructure 不承载业务编排"）
- `FileStorageAdapter` contract（`src/modules/blog/contracts/file-storage.contract.ts`）是 module-owned boundary contract，`LocalFileStorageAdapter` 是其实现，符合 boundary-contract.rules
- 不得在 `BlogFileEntity` 中添加 GraphQL decorator（entity.rules: "ORM Entity 不表达 API 协议"）

### 验收标准

- 文件上传功能正常
- 中文文件名的文件可正常上传
- 文件名冲突时不会覆盖已有文件
- `graphql-upload` 加载失败时有明确错误提示

---

## 问题 3：置顶功能仅在 Blog Admin

### 修复前必读

- [ ] `docs/common/usecase.rules.md` — 确认 ListBlogPublishedPostsUsecase 排序逻辑
- [ ] `docs/api/adapters.rules.md` — 确认 BlogPostObjectType 已暴露 isPinned

### 分析

后端 `ListBlogPublishedPostsUsecase` 已在排序中前置 `isPinned DESC`，`BlogPostObjectType` 已暴露 `isPinned` 字段。后端无需修改。

---

## 问题 4：回收站无法正常运作

### 修复前必读

- [ ] `docs/common/queryservice.rules.md` — 确认 BlogPostQueryService 的 deleted posts 查询逻辑
- [ ] `docs/api/adapters.rules.md` — 确认 blogDeletedPosts resolver 实现

### 分析

后端已正确实现：
- `blogDeletedPosts` query：使用 `withDeleted()` + `deleted_at IS NOT NULL`
- `restoreBlogPost` mutation：恢复软删除文章
- `permanentDeleteBlogPost` mutation：永久删除
- `BlogPostObjectType` 已有 `deletedAt` 字段

**问题在前端**：使用了 `blogPosts(status: DELETED)` 而非 `blogDeletedPosts`。后端无需修改。

---

## 问题 5：点赞无账号划分

### 修复前必读

- [ ] `docs/api/adapters.rules.md` — 确认 resolver 中 JWT 解析方式、权限守卫使用
- [ ] `docs/common/boundary-contract.rules.md` — 确认不引入新 boundary contract
- [ ] `docs/common/usecase.rules.md` — 确认 usecase 不需要修改
- [ ] `docs/common/modules.rules.md` — 确认 BlogLikeService 不需要修改

### 根因分析

**核心问题**：`BlogLikeResolver` 的 `toggleBlogPostLike` 和 `hasLikedBlogPost` 是公开接口，完全信任前端传的 `userIdentifier`。当前前端硬编码为 `'anonymous'`，导致所有用户共享同一标识。

后端 `BlogLikeEntity` 使用 `(postId, userIdentifier)` 联合唯一约束，设计上支持按用户区分，但 resolver 未利用 JWT 信息。

### 修复方案

**策略**：已登录用户从 JWT 获取 `accountId` 作为权威 `userIdentifier`，未登录用户使用前端传的 `userIdentifier`（如浏览器指纹）。

| 文件 | 修改内容 | 规范合规说明 |
|------|----------|-------------|
| `src/adapters/api/graphql/blog/blog-like.resolver.ts` | `toggleBlogPostLike` 和 `hasLikedBlogPost` 添加可选 JWT 解析：如果请求携带 Authorization header，从 JWT 获取 `sub`（accountId），使用 `user:{sub}` 作为 `userIdentifier`，忽略前端传的值；未携带时仍使用前端传的 `userIdentifier` | Adapter 负责"权限守卫与身份注入"（adapters.rules），JWT 解析属于身份注入范畴 |
| `src/usecases/blog/toggle-blog-post-like.usecase.ts` | 无需修改 | Usecase 只关心 `userIdentifier` 参数，不关心其来源 |
| `src/modules/blog/blog-like.service.ts` | 无需修改 | Service 只提供细粒度写操作 |
| `src/modules/blog/entities/blog-like.entity.ts` | 无需修改，`userIdentifier` 字段长度 255 足够 | Entity 纯度不变 |

**实现细节**：

```typescript
// blog-like.resolver.ts 伪代码
@Mutation(() => Boolean, { description: '点赞/取消点赞文章' })
async toggleBlogPostLike(
  @Args('postId', { type: () => Int }) postId: number,
  @Args('userIdentifier', { type: () => String }) userIdentifier: string,
  @Context() context: GraphQLContext,
): Promise<boolean> {
  // 尝试从请求中提取 JWT 用户信息
  const effectiveIdentifier = this.resolveUserIdentifier(context, userIdentifier);
  const { liked } = await this.toggleBlogPostLikeUsecase.execute(postId, effectiveIdentifier);
  return liked;
}

private resolveUserIdentifier(context: GraphQLContext, fallback: string): string {
  const user = context.req?.user; // JwtAuthGuard 设置的
  if (user?.sub) {
    return `user:${user.sub}`;
  }
  return fallback;
}
```

**规范合规注意**：
- JWT 解析逻辑放在 resolver（adapter 层），因为这是"权限守卫与身份注入"（adapters.rules: "权限守卫与身份注入，包括 Guard、Decorator"）
- 不添加 `@UseGuards(JwtAuthGuard)` 以保持接口公开，仅在请求携带 token 时提取用户信息。这符合 adapters.rules 中"currentUser 统一从 GraphQL context 注入"的原则
- 不需要修改 usecase 或 service，因为 `userIdentifier` 的解析是 adapter 层的职责（adapters.rules: "Adapter 负责协议转换，将外部协议输入转换为用例参数"）
- 不需要新增 boundary contract，因为 JWT 解析使用的是 NestJS 内置的 `GqlExecutionContext`，不涉及新的外部依赖
- `resolveUserIdentifier` 是 resolver 的私有方法，不暴露到上游，符合 adapters.rules 中"一个 I/O 一个文件"的结构要求

### 验收标准

- 已登录用户点赞时 `userIdentifier` 为 `user:{accountId}`
- 未登录用户点赞时 `userIdentifier` 为前端传的值
- 不同用户的点赞状态独立
- 点赞/取消点赞正常工作
- `hasLikedBlogPost` 对已登录用户使用 JWT 中的 accountId 查询

---

## 问题 6：Blog Admin 仍在 labs 区（前端）

### 分析

前端 Blog Admin 的 UI 组件仍在 `labs/blog-admin/` 中，但 blog 已是正式业务功能，应迁入 stable 区。这是纯前端问题，后端无需修改。

前端修复计划详见前端计划文档的"问题 6"章节。

---

## 执行顺序

1. **问题 5（点赞账号划分）**：已完成 ✅
2. **问题 2（文件上传）**：已完成 ✅
3. **问题 1（ADMIN 权限）**：已完成 ✅ — 后端代码逻辑正确，根因为数据层面 ADMIN 账户的 access_group 未包含 ADMIN 角色，已创建 migration 1773930500000 修复
4. **问题 4（回收站）**：纯前端问题，后端无需修改
5. **问题 3（置顶展示）**：纯前端问题，后端无需修改

---

## 自检清单

### 规范合规

- [ ] ORM Entity 不包含 GraphQL/HTTP decorator（entity.rules）
- [ ] Resolver 不实现业务规则，只做协议转换和身份注入（adapters.rules）
- [ ] Usecase 不直接依赖 infrastructure（usecase.rules）
- [ ] QueryService 不产生副作用（queryservice.rules）
- [ ] Infrastructure 不承载业务编排（infrastructure.rules）
- [ ] 新增 boundary contract 使用 `*.contract.ts` 后缀（boundary-contract.rules）
- [ ] Modules(service) 不跨域依赖（modules.rules）
- [ ] 对外输出是 View/DTO，不暴露 ORM Entity（entity.rules + modules.rules）

### 功能验证

- [ ] `tsc --noEmit` 无错误
- [ ] `npm run test` 全部通过
- [ ] 非 mahiru 的 ADMIN 账户可正常调用 Blog Admin API
- [ ] 文件上传功能正常
- [ ] 已登录用户点赞使用 `user:{accountId}` 作为标识
- [ ] 未登录用户点赞使用前端传的 `userIdentifier`
- [ ] 不同用户的点赞状态独立
