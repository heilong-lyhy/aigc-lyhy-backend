# 博客功能完善工作规划（后端部分）

> 创建时间：2026-06-08
> 状态：待执行

---

## 进度跟踪

| 任务 | 状态 | 阻塞项 | 开始时间 | 完成时间 | 备注 |
|------|------|--------|----------|----------|------|
| 1.1 公开文章列表分类/关键词筛选 | 已完成 | 无 | 2026-06-08 | 2026-06-08 | |
| 1.2 公开文章列表标签筛选 | 已完成 | 无 | 2026-06-08 | 2026-06-08 | EXISTS 子查询，tagId 索引已存在 |
| 1.3 阅读量自增 | 已完成 | 无 | 2026-06-09 | 2026-06-09 | fire-and-forget，失败不影响详情返回 |
| 1.4 标签更新 Mutation | 已完成 | 无 | 2026-06-09 | 2026-06-09 | 参考 update-blog-category 模板，复用 assertSlugUnique(slug, excludeId) |
| 1.5 评论管理回复 Mutation | 已完成 | 无 | 2026-06-09 | 2026-06-09 | 新增 isAdminReply 字段、ReplyBlogCommentUsecase、replyBlogComment mutation；管理员回复自动审核通过 |
| 2.1 上一篇/下一篇 | 已完成 | 无 | 2026-06-09 | 2026-06-09 | 基于 publishedAt + id 双排序，BlogPostDetailView 内置 prevPost/nextPost |
| 2.2 友情链接功能 | 已完成 | 无 | 2026-06-10 | 2026-06-10 | Entity/Service/QueryService/Usecase/Resolver 全链路；公开 blogFriendLinks + 管理 CRUD；增量 migration 1773930200000 |
| 2.3 评论隐藏 | 已完成 | 无 | 2026-06-10 | 2026-06-10 | is_hidden 布尔列；公开列表排除隐藏评论；hideBlogComment/unhideBlogComment mutation；增量 migration 1773930300000 |
| 3.1 软删除/回收站 | 已完成 | 无 | 2026-06-10 | 2026-06-10 | restorePost/permanentDeletePost/listDeletedPosts 全链路；新增 POST_ALREADY_RESTORED 错误码 |
| 3.2 Gravatar 头像 | 已完成 | 无 | 2026-06-10 | 2026-06-10 | CravatarAvatarGeneratorAdapter 替换 GravatarAvatarGeneratorAdapter，DI 绑定已切换 |

## 风险登记

| 风险 | 影响 | 概率 | 触发条件 | 应对方案 |
|------|------|------|----------|----------|
| 标签筛选 EXISTS 子查询性能问题 | 分页数据不准确/响应慢 | 中 | 文章数 > 1000 且同时使用标签筛选 | 先做性能评估；不达标时改为先查 `blog_post_tag` 获取 postId 列表，再用 `WHERE id IN (...)` |
| 阅读量自增并发问题 | 数据不一致 | 低 | 同一文章短时间内大量并发请求 | TypeORM `increment` 已生成原子 SQL；P3 考虑 Redis 缓存 |
| 评论隐藏用枚举修改可能破坏现有数据 | 现有评论状态异常 | 低 | 修改 `BlogCommentStatus` 枚举值 | 改用 `is_hidden` 布尔列，不修改枚举 |
| 友链外链影响 SEO | 搜索引擎降权 | 低 | 大量低质量外链 | 添加 `rel="noopener noreferrer"`；管理员审核制 |

---

## 阶段一：核心功能补全（P1）

> 目标：让前台已有 UI 真正可用，消除"有按钮无效果"的问题

### 1.1 公开文章列表支持分类/关键词筛选

> **前置步骤**：开始编码前，必须先阅读 `docs/` 下的项目规范文件（至少包括 `docs/README.md`、`docs/api/adapters.rules.md`、`docs/common/usecase.rules.md`、`docs/common/queryservice.rules.md`），确认修改符合分层规范与依赖方向后再动手。

**问题**：`ListBlogPublishedPostsUsecase` 硬编码排除了 `categoryId`、`title` 参数，导致前台分类筛选和搜索不生效。

**已验证**：`BlogPostQueryService.createPostQueryBuilder()` 已实现 `categoryId` 和 `title` 过滤，只需打通 usecase → resolver 传参链路。

**设计决策**：
- `categoryId` + `tagId` 同时传递时为 **AND** 语义（文章既属该分类又含该标签）
- `title` 使用 `LIKE '%xxx%'` 模糊匹配，当前数据量下性能可接受；长期需引入全文索引

**修改文件**：

| 文件 | 修改内容 |
|------|----------|
| `src/usecases/blog/blog-read.usecase.ts` | `ListBlogPublishedPostsUsecase.execute()` 参数类型从 `Omit<..., 'status' \| 'categoryId' \| 'title'>` 改为 `Omit<..., 'status'>`；传递 `categoryId` 和 `title` |
| `src/adapters/api/graphql/blog/dto/blog-pagination.args.ts` | 新建 `BlogPublishedPostsArgs` 继承 `BlogPaginationArgs`，添加可选 `categoryId: Int`、`title: String` |
| `src/adapters/api/graphql/blog/blog-post.resolver.ts` | `blogPublishedPosts` 参数从 `BlogPaginationArgs` 改为 `BlogPublishedPostsArgs`；传递 `categoryId` 和 `title` 到 usecase |

**验收标准**：
- GraphQL 查询 `blogPublishedPosts(page:1, limit:6, categoryId:1)` 返回该分类下的文章
- GraphQL 查询 `blogPublishedPosts(page:1, limit:6, title:"测试")` 返回标题含"测试"的文章
- 不传 `categoryId`/`title` 时行为与修改前一致
- `categoryId` + `tagId` 同时传递时返回同时满足两个条件的文章

### 1.2 公开文章列表支持标签筛选

> **前置步骤**：开始编码前，必须先阅读 `docs/` 下的项目规范文件（至少包括 `docs/README.md`、`docs/api/adapters.rules.md`、`docs/common/usecase.rules.md`、`docs/common/queryservice.rules.md`），确认修改符合分层规范与依赖方向后再动手。

**问题**：`createPostQueryBuilder` 不支持按标签筛选，需通过 `blog_post_tag` 关联表查询。

**设计决策**：
- 使用 `EXISTS` 子查询替代 JOIN，避免 DISTINCT 导致的分页偏移问题
- 先做性能评估：确认 `blog_post_tag` 表的 `tag_id` 列有索引

**性能兜底方案**：若 EXISTS 子查询性能不达标，改为在 `BlogPostQueryService` 中先查 `blog_post_tag` 获取 `postId` 列表，再用 `WHERE id IN (...)` 过滤。

**修改文件**：

| 文件 | 修改内容 |
|------|----------|
| `src/modules/blog/queries/blog-post.query.service.ts` | `BlogPostPaginationParams` 添加 `tagId?: number`；`createPostQueryBuilder` 添加 tagId 过滤（使用 EXISTS 子查询：`WHERE EXISTS (SELECT 1 FROM blog_post_tag WHERE post_id = blog_post.id AND tag_id = :tagId)`） |
| `src/usecases/blog/blog-read.usecase.ts` | `ListBlogPublishedPostsUsecase.execute()` 传递 `tagId` |
| `src/adapters/api/graphql/blog/dto/blog-pagination.args.ts` | `BlogPublishedPostsArgs` 添加可选 `tagId: Int` |
| `src/adapters/api/graphql/blog/blog-post.resolver.ts` | 传递 `tagId` 到 usecase |

**验收标准**：
- GraphQL 查询 `blogPublishedPosts(page:1, limit:6, tagId:2)` 返回含该标签的文章
- 分页数据准确（total 与实际匹配数一致）

### 1.3 文章详情查询自动增加阅读量

> **前置步骤**：开始编码前，必须先阅读 `docs/` 下的项目规范文件（至少包括 `docs/README.md`、`docs/api/adapters.rules.md`、`docs/common/usecase.rules.md`、`docs/common/queryservice.rules.md`），确认修改符合分层规范与依赖方向后再动手。

**问题**：`BlogPostService.incrementViewCount()` 方法存在但从未被调用，阅读量始终为 0。

**设计决策**：
- 使用 `repo.increment({ id }, 'viewCount', 1)` 原子操作，避免先 SELECT 再 UPDATE 的并发问题
- 仅在**公开接口**（`blogPostBySlug`）自增，管理端预览不计入
- fire-and-forget 方式调用，失败时记录日志但不影响详情返回
- 防刷机制（IP 去重）延后到 P3

**修改文件**：

| 文件 | 修改内容 |
|------|----------|
| `src/usecases/blog/blog-read.usecase.ts` | `GetBlogPostBySlugUsecase` 注入 `BlogPostService`；`execute()` 返回前调用 `incrementViewCount(id)`（fire-and-forget + catch 日志） |
| `src/usecases/blog/blog-usecases.module.ts` | `GetBlogPostBySlugUsecase` 添加 `BlogPostService` 依赖 |

**验收标准**：
- 每次查询 `blogPostBySlug` 后，该文章 `viewCount` +1
- 文章不存在时不报错
- `incrementViewCount` 失败时详情仍正常返回，日志记录错误

### 1.4 标签更新 Mutation

> **前置步骤**：开始编码前，必须先阅读 `docs/` 下的项目规范文件（至少包括 `docs/README.md`、`docs/api/adapters.rules.md`、`docs/common/usecase.rules.md`、`docs/common/queryservice.rules.md`），确认修改符合分层规范与依赖方向后再动手。

**问题**：后端只有 `createBlogTag` 和 `deleteBlogTag`，无 `updateBlogTag`，前端标签管理无法编辑。

**设计决策**：
- 参考 `update-blog-category.usecase.ts` 作为实现模板
- 允许修改 slug，但在文档中标注风险：slug 变更可能影响已有 URL 引用
- 复用 `assertSlugUnique(slug, excludeId)` 排除自身

**修改文件**：

| 文件 | 修改内容 |
|------|----------|
| `src/modules/blog/blog-tag.service.ts` | 添加 `update(id, input: { name: string; slug?: string })` 方法，复用 `assertSlugUnique(slug, id)` |
| 新建 `src/usecases/blog/update-blog-tag.usecase.ts` | `execute(id, input)` → 调用 `BlogTagService.update()`（参考 `update-blog-category.usecase.ts` 模板） |
| 新建 `src/adapters/api/graphql/blog/dto/update-blog-tag.input.ts` | `UpdateBlogTagInput` DTO |
| `src/adapters/api/graphql/blog/blog-tag.resolver.ts` | 添加 `updateBlogTag` mutation（需 ADMIN 权限） |
| `src/usecases/blog/blog-usecases.module.ts` | 注册 `UpdateBlogTagUsecase` |

**验收标准**：
- `updateBlogTag(id:1, input:{name:"新名称"})` 更新成功
- slug 重复时返回错误
- 更新 slug 后旧 slug 不再可用

### 1.5 评论管理回复 Mutation

> **前置步骤**：开始编码前，必须先阅读 `docs/` 下的项目规范文件（至少包括 `docs/README.md`、`docs/api/adapters.rules.md`、`docs/common/usecase.rules.md`、`docs/common/queryservice.rules.md`），确认修改符合分层规范与依赖方向后再动手。

**问题**：管理端无法回复评论。`CreateBlogCommentUsecase` 已支持 `parentId`/`replyToId`，只需添加管理员专用 mutation。

**设计决策**：
- 添加 `isAdminReply: boolean` 字段到 `BlogComment`，前端可据此显示管理员徽章
- 管理员回复的 `authorName` 自动设为博主昵称（从 `BlogProfileQueryService.getProfile()` 读取 `nickname` 字段）
- **注意**：`BlogCommentEntity` 已有 `authorAvatar` 列，且 `BlogCommentService.createComment` 已通过 `AvatarGenerator` 契约生成头像。管理员回复同样会自动生成头像，无需额外处理

**修改文件**：

| 文件 | 修改内容 |
|------|----------|
| `src/adapters/api/graphql/blog/blog-comment.resolver.ts` | 添加 `replyBlogComment` mutation（ADMIN 权限），复用 `CreateBlogCommentUsecase`，设置 `isAdminReply: true`；注入 `BlogProfileQueryService` 获取博主昵称 |
| 新建 `src/adapters/api/graphql/blog/dto/reply-blog-comment.input.ts` | `ReplyBlogCommentInput`：`postId: Int!`, `content: String!`, `parentId: Int`, `replyToId: Int` |
| `src/adapters/api/graphql/blog/dto/blog-comment.dto.ts` | `BlogCommentObjectType` 添加 `isAdminReply: Boolean` 字段 |
| `src/modules/blog/entities/blog-comment.entity.ts` | 添加 `isAdminReply` 列（默认 `false`） |
| `src/usecases/blog/blog-usecases.module.ts` | 确认 `BlogProfileService` 已在 module 中提供 |
| 数据库迁移 | `blog_comments` 表添加 `is_admin_reply` 列 |

**验收标准**：
- 管理员可通过 `replyBlogComment` 回复评论
- 回复正确关联 `parentId`/`replyToId`
- 管理员回复的 `isAdminReply` 为 `true`
- 管理员回复的 `authorName` 为博主昵称

### 阶段一测试补充

| 测试文件 | 覆盖内容 |
|----------|----------|
| `src/usecases/blog/list-blog-published-posts.usecase.spec.ts` | 分类筛选、关键词搜索、标签筛选、组合筛选、空结果 |
| `src/usecases/blog/get-blog-post-by-slug.usecase.spec.ts` | 阅读量自增、文章不存在、自增失败不影响返回 |
| `src/usecases/blog/update-blog-tag.usecase.spec.ts` | 正常更新、slug 重复、标签不存在 |
| `src/adapters/api/graphql/blog/blog-comment.resolver.spec.ts` | 管理员回复、非管理员禁止、回复关联正确、博主昵称自动填充 |

### 阶段一自检清单

- [ ] `tsc --noEmit` 无错误
- [ ] `npm run test` 全部通过
- [ ] GraphQL Playground 验证：`blogPublishedPosts` 支持 `categoryId`/`title`/`tagId` 参数
- [ ] GraphQL Playground 验证：`blogPostBySlug` 返回后 `viewCount` 自增
- [ ] GraphQL Playground 验证：`updateBlogTag` mutation 正常工作
- [ ] GraphQL Playground 验证：`replyBlogComment` mutation 正常工作
- [ ] 确认前端 `pageSize` 正确映射到后端 `limit`（GraphQL 变量名）

---

## 阶段二：功能增强（P2）

> 目标：补齐缺失的独立功能模块

### 2.1 上一篇/下一篇文章

> **前置步骤**：开始编码前，必须先阅读 `docs/` 下的项目规范文件（至少包括 `docs/README.md`、`docs/api/adapters.rules.md`、`docs/common/usecase.rules.md`、`docs/common/queryservice.rules.md`），确认修改符合分层规范与依赖方向后再动手。

**设计决策**：
- 跨全站排序（不限定分类），基于 `publishedAt` 降序
- secondary sort by `id`，避免 `publishedAt` 相同时排序不稳定
- 使用单条 SQL 查询相邻文章，避免 N+1

**修改文件**：

| 文件 | 修改内容 |
|------|----------|
| `src/modules/blog/queries/blog-post.query.service.ts` | 添加 `findPrevPost(publishedAt: Date, id: number)` 和 `findNextPost(publishedAt: Date, id: number)` 方法（单条 SQL，secondary sort by id） |
| `src/adapters/api/graphql/blog/blog-post.object-type.ts` | `BlogPostDetailObjectType` 添加 `prevPost` 和 `nextPost` 可选字段（FieldResolver） |
| `src/adapters/api/graphql/blog/blog-post.resolver.ts` | 添加 `@ResolveField` 解析 prevPost/nextPost |

**验收标准**：
- 查询文章详情时返回 `prevPost { id title slug }` 和 `nextPost { id title slug }`
- 第一篇文章 `prevPost` 为 null，最后一篇 `nextPost` 为 null
- `publishedAt` 相同时按 `id` 排序

### 2.2 友情链接功能

> **前置步骤**：开始编码前，必须先阅读 `docs/` 下的项目规范文件（至少包括 `docs/README.md`、`docs/api/adapters.rules.md`、`docs/common/usecase.rules.md`、`docs/common/queryservice.rules.md`、`docs/common/boundary-contract.rules.md`），确认修改符合分层规范与依赖方向后再动手。

**设计决策**：
- 仅管理员可添加/编辑/删除友链，前台只展示
- 前台链接添加 `rel="noopener noreferrer"` + `target="_blank"`
- 不做点击统计、不做申请表单

**新建文件清单**：

| 文件 | 说明 |
|------|------|
| `src/modules/blog/entities/blog-friend-link.entity.ts` | 实体 |
| `src/modules/blog/blog-friend-link.service.ts` | 写服务（CRUD） |
| `src/modules/blog/queries/blog-friend-link.query.service.ts` | 读服务 |
| `src/usecases/blog/list-blog-friend-links.usecase.ts` | 公开列表 |
| `src/usecases/blog/create-blog-friend-link.usecase.ts` | 创建 |
| `src/usecases/blog/update-blog-friend-link.usecase.ts` | 更新 |
| `src/usecases/blog/delete-blog-friend-link.usecase.ts` | 删除 |
| `src/adapters/api/graphql/blog/blog-friend-link.resolver.ts` | Resolver |
| `src/adapters/api/graphql/blog/dto/blog-friend-link.dto.ts` | ObjectType |
| `src/adapters/api/graphql/blog/dto/create-blog-friend-link.input.ts` | 创建输入 |
| `src/adapters/api/graphql/blog/dto/update-blog-friend-link.input.ts` | 更新输入 |
| `src/usecases/blog/blog-usecases.module.ts` | 注册 4 个新增 usecase |
| `src/modules/blog/blog.module.ts` | 注册 `BlogFriendLink` entity |
| 数据库迁移 | `blog_friend_links` 表 |

**表结构**：

```sql
CREATE TABLE blog_friend_links (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT '站点名称',
  url VARCHAR(500) NOT NULL COMMENT '站点 URL',
  description VARCHAR(500) DEFAULT NULL COMMENT '站点描述',
  logo_url VARCHAR(500) DEFAULT NULL COMMENT 'Logo URL',
  sort_order INT DEFAULT 0 COMMENT '排序（越小越靠前）',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL
);
```

**验收标准**：
- 公开 query `blogFriendLinks` 返回启用的友链列表（按 `sortOrder` 排序）
- 管理 mutation `createBlogFriendLink`/`updateBlogFriendLink`/`deleteBlogFriendLink` 正常工作

### 2.3 评论隐藏

> **前置步骤**：开始编码前，必须先阅读 `docs/` 下的项目规范文件（至少包括 `docs/README.md`、`docs/api/adapters.rules.md`、`docs/common/usecase.rules.md`、`docs/common/queryservice.rules.md`），确认修改符合分层规范与依赖方向后再动手。

**设计决策**：
- 不修改 `BlogCommentStatus` 枚举，改用 `is_hidden` 布尔列，更安全且向后兼容
- 隐藏 ≠ 驳回：驳回 = 审核不通过；隐藏 = 内容违规被强制下架但保留记录
- 公开评论列表同时排除 `rejected` 和 `is_hidden = true` 的评论

**修改文件**：

| 文件 | 修改内容 |
|------|----------|
| `src/modules/blog/entities/blog-comment.entity.ts` | 添加 `isHidden` 列（默认 `false`） |
| `src/modules/blog/queries/blog-comment.query.service.ts` | 公开列表查询添加 `is_hidden = false` 条件 |
| `src/adapters/api/graphql/blog/blog-comment.resolver.ts` | 添加 `hideBlogComment` mutation（设置 `isHidden = true`）；添加 `unhideBlogComment` mutation |
| `src/adapters/api/graphql/blog/dto/blog-comment.dto.ts` | `BlogCommentObjectType` 添加 `isHidden: Boolean` 字段 |
| 数据库迁移 | `blog_comments` 表添加 `is_hidden` 列 |

**验收标准**：
- `hideBlogComment(id:1)` 设置 `isHidden = true`
- `unhideBlogComment(id:1)` 设置 `isHidden = false`
- 公开评论列表不返回 `isHidden = true` 的评论
- 管理端可查看所有评论（含隐藏）

### 阶段二测试补充

| 测试文件 | 覆盖内容 |
|----------|----------|
| `src/modules/blog/queries/blog-post.query.service.spec.ts` | prevPost/nextPost 查询、边界情况（首篇/末篇） |
| `src/usecases/blog/list-blog-friend-links.usecase.spec.ts` | 列表查询、排序、仅返回启用项 |
| `src/usecases/blog/create-blog-friend-link.usecase.spec.ts` | 创建、URL 校验 |
| `src/usecases/blog/update-blog-friend-link.usecase.spec.ts` | 更新、不存在 |
| `src/usecases/blog/delete-blog-friend-link.usecase.spec.ts` | 删除、不存在 |
| `src/adapters/api/graphql/blog/blog-comment.resolver.spec.ts` | 隐藏/取消隐藏、非管理员禁止（**追加到阶段一同文件**） |

### 阶段二自检清单

- [ ] `tsc --noEmit` 无错误
- [ ] `npm run test` 全部通过
- [ ] GraphQL Playground 验证：`blogPostBySlug` 返回 `prevPost`/`nextPost`
- [ ] GraphQL Playground 验证：`blogFriendLinks` query 正常工作
- [ ] GraphQL Playground 验证：`hideBlogComment`/`unhideBlogComment` mutation 正常工作
- [ ] 数据库迁移执行成功
- [ ] 确认前端 `pageSize` 正确映射到后端 `limit`

---

## 阶段三：体验优化（P3）

> 目标：锦上添花，提升用户体验

### 3.1 软删除/回收站

> **前置步骤**：开始编码前，必须先阅读 `docs/` 下的项目规范文件（至少包括 `docs/README.md`、`docs/api/adapters.rules.md`、`docs/common/usecase.rules.md`、`docs/common/queryservice.rules.md`），确认修改符合分层规范与依赖方向后再动手。

**设计决策**：
- 软删除文章时，关联的评论、标签关联**保留不删除**（恢复时自动还原）
- 永久删除时级联删除关联数据
- 不做自动清理，由管理员手动永久删除

**修改文件**：

| 文件 | 修改内容 |
|------|----------|
| `src/modules/blog/blog-post.service.ts` | 添加 `restorePost(id)` 方法；添加 `listDeletedPosts()` 方法；添加 `permanentDeletePost(id)` 方法 |
| `src/modules/blog/queries/blog-post.query.service.ts` | 添加 `createDeletedPostsQueryBuilder()` 查询已软删除文章 |
| 新建 `src/usecases/blog/restore-blog-post.usecase.ts` | 恢复文章 |
| 新建 `src/usecases/blog/list-deleted-blog-posts.usecase.ts` | 列出已删除文章 |
| 新建 `src/usecases/blog/permanent-delete-blog-post.usecase.ts` | 永久删除 |
| `src/usecases/blog/blog-usecases.module.ts` | 注册 3 个新增 usecase |
| `src/adapters/api/graphql/blog/blog-post.resolver.ts` | 添加 `restoreBlogPost` mutation、`blogDeletedPosts` query、`permanentDeleteBlogPost` mutation |

**验收标准**：
- 删除文章后可在回收站查看
- 可恢复已删除文章（关联数据自动还原）
- 可永久删除（级联删除关联数据）

### 3.2 Cravatar 头像自动生成

> **前置步骤**：开始编码前，必须先阅读 `docs/` 下的项目规范文件（至少包括 `docs/README.md`、`docs/api/adapters.rules.md`、`docs/common/boundary-contract.rules.md`、`docs/common/type.rules.md`），确认修改符合分层规范与依赖方向后再动手。

**设计决策**：
- 使用 Cravatar（`cravatar.cn`）替代 Gravatar，国内访问稳定
- **复用现有 `AvatarGenerator` 契约**：项目已有 `AvatarGenerator` boundary contract + `GravatarAvatarGeneratorAdapter`，只需新建 `CravatarAvatarGeneratorAdapter` 并替换 DI 绑定
- 无邮箱时使用 identicon 默认头像
- 无需修改 `BlogCommentQueryService`，头像生成已在 `BlogCommentService.createComment` 中完成

**依赖说明**：需要 `crypto` 库生成邮箱哈希。项目使用 Node.js 内置 `crypto.createHash('md5')`，无需额外安装依赖（与现有 `GravatarAvatarGeneratorAdapter` 一致）。

**修改文件**：

| 文件 | 修改内容 |
|------|----------|
| 新建 `src/infrastructure/blog-storage/cravatar-avatar-generator.adapter.ts` | 实现 `AvatarGenerator` 接口：`generateAvatar(email)` → `https://cravatar.cn/avatar/${md5(email)}?d=identicon`（参考现有 `GravatarAvatarGeneratorAdapter` 模板） |
| `src/modules/blog/blog.module.ts` | 将 `{ provide: BLOG_AVATAR_GENERATOR_TOKEN, useClass: GravatarAvatarGeneratorAdapter }` 改为 `{ provide: BLOG_AVATAR_GENERATOR_TOKEN, useClass: CravatarAvatarGeneratorAdapter }` |

**验收标准**：
- 新评论的 `authorAvatar` 使用 Cravatar URL
- 无邮箱时返回 `null`（与现有行为一致）
- 现有评论头像 URL 不受影响（头像 URL 在创建时生成，不会回溯更新）

### 阶段三测试补充

| 测试文件 | 覆盖内容 |
|----------|----------|
| `src/usecases/blog/restore-blog-post.usecase.spec.ts` | 恢复成功、文章不存在 |
| `src/usecases/blog/list-deleted-blog-posts.usecase.spec.ts` | 列表查询、分页 |
| `src/usecases/blog/permanent-delete-blog-post.usecase.spec.ts` | 永久删除、级联删除关联数据 |
| `src/infrastructure/blog-storage/cravatar-avatar-generator.adapter.spec.ts` | Cravatar URL 生成、无邮箱返回 null、与 GravatarAdapter 接口一致 |

### 阶段三自检清单

- [ ] `tsc --noEmit` 无错误
- [ ] `npm run test` 全部通过
- [ ] GraphQL Playground 验证：回收站 query/mutation 正常工作
- [ ] GraphQL Playground 验证：新评论的 `authorAvatar` 使用 Cravatar URL
- [ ] 浏览器验证：头像正常显示

---

## e2e 测试规划

> 关键端到端流程验证，每个阶段完成后执行

| 流程 | 覆盖阶段 | 验证内容 |
|------|----------|----------|
| 发布文章 → 前台展示 → 用户评论 → 管理员回复 → 前台查看 | P1+P2 | 全链路数据流通 |
| 搜索关键词 → 筛选分类 → 点击文章 → 上一篇/下一篇导航 | P1+P2 | 筛选+导航流程 |
| 管理员隐藏评论 → 前台不可见 → 取消隐藏 → 前台可见 | P2 | 评论隐藏流程 |
| 删除文章 → 回收站查看 → 恢复文章 → 前台可见 | P3 | 软删除流程 |

---

## 数据库迁移策略

阶段一 1.5（`is_admin_reply` 列）、阶段二 2.2（`blog_friend_links` 表）、阶段二 2.3（`is_hidden` 列）都需要数据库迁移。

**建议**：开发阶段可逐个执行迁移；**部署时合并为一个迁移文件**，减少部署复杂度。合并迁移文件应在阶段二完成时统一生成。

---

## 执行顺序与依赖关系

```
阶段一（可并行，无相互依赖）
├── 1.1 公开文章列表分类/关键词筛选  ← 阻塞：前端 1.1, 1.2
├── 1.2 公开文章列表标签筛选        ← 阻塞：前端 1.1
│   └── ⚠️ 先做性能评估（EXISTS 子查询 + 分页）
│   └── 兜底：改为先查 blog_post_tag 获取 postId 列表
├── 1.3 阅读量自增
├── 1.4 标签更新 Mutation           ← 阻塞：前端 2.3
└── 1.5 评论管理回复 Mutation       ← 阻塞：前端 2.4
    └── 需数据库迁移（is_admin_reply 列）

阶段二（部分依赖阶段一）
├── 2.1 上一篇/下一篇               ← 阻塞：前端 2.1
├── 2.2 友情链接                    ← 阻塞：前端 2.5（需数据库迁移）
└── 2.3 评论隐藏                    ← 阻塞：前端 3.3（需数据库迁移）

阶段三（低优先级）
├── 3.1 软删除/回收站               ← 阻塞：前端 3.2
└── 3.2 Cravatar 头像               ← 阻塞：前端 3.1
```
