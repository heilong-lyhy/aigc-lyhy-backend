# 修复计划：Blog GraphQL 类型对齐（后端部分）

> 创建时间：2026-06-08
> 状态：待执行

---

## 问题：ObjectType 类名与前端 Fragment 类型名不匹配

### 现状

NestJS GraphQL 默认将类名注册为 Schema 类型名，导致后端 Schema 中的类型名带有 `ObjectType` 后缀，与前端 Fragment 使用的简短名称不一致：

| 前端 Fragment 使用的类型名 | 后端实际 Schema 类型名 | 状态 |
|---|---|---|
| `BlogPost` | `BlogPostObjectType` | 不匹配 |
| `BlogPostDetail` | `BlogPostDetailObjectType` | 不匹配 |
| `BlogComment` | `BlogCommentObjectType` | 不匹配 |
| `BlogFile` | `BlogFileObjectType` | 不匹配 |
| `BlogCategory` | `BlogCategoryObjectType` | 不匹配 |
| `BlogTag` | `BlogTagObjectType` | 不匹配 |
| `BlogProfile` | `BlogProfileObjectType` | 不匹配 |
| `BlogDashboard` | `BlogDashboardObjectType` | 不匹配 |

同时，`sortOrder` 参数在前端声明为 `String`，但后端定义的是枚举类型 `SortDirection`（值为 `ASC` / `DESC`）。

### 修改方案

在 `@ObjectType()` 装饰器中添加显式 `name` 参数，使 GraphQL Schema 暴露简短类型名，与前端对齐。

### 修改清单

| 文件 | 修改 |
|---|---|
| `src/adapters/api/graphql/blog/dto/blog-post.dto.ts` | `@ObjectType({ description: '文章' })` → `@ObjectType('BlogPost', { description: '文章' })` |
| `src/adapters/api/graphql/blog/dto/blog-post-detail.dto.ts` | `@ObjectType({ description: '文章详情' })` → `@ObjectType('BlogPostDetail', { description: '文章详情' })` |
| `src/adapters/api/graphql/blog/dto/blog-comment.dto.ts` | `@ObjectType({ description: '评论' })` → `@ObjectType('BlogComment', { description: '评论' })` |
| `src/adapters/api/graphql/blog/dto/blog-file.dto.ts` | `@ObjectType({ description: '博客文件' })` → `@ObjectType('BlogFile', { description: '博客文件' })` |
| `src/adapters/api/graphql/blog/dto/blog-files.list.ts` | `@ObjectType({ description: '文件列表' })` → `@ObjectType('BlogFilesListResponse', { description: '文件列表' })` |
| `src/adapters/api/graphql/blog/dto/blog-comments.list.ts` | `@ObjectType({ description: '评论列表' })` → `@ObjectType('BlogCommentsListResponse', { description: '评论列表' })` |
| `src/adapters/api/graphql/blog/dto/blog-posts.list.ts` | `@ObjectType({ description: '文章列表' })` → `@ObjectType('BlogPostsListResponse', { description: '文章列表' })` |
| `src/adapters/api/graphql/blog/dto/blog-dashboard.dto.ts` | `@ObjectType({ description: '博客仪表盘统计' })` → `@ObjectType('BlogDashboard', { description: '博客仪表盘统计' })` |
| `src/adapters/api/graphql/blog/dto/blog-profile.dto.ts` | `@ObjectType({ description: '博主信息' })` → `@ObjectType('BlogProfile', { description: '博主信息' })` |
| `src/adapters/api/graphql/blog/dto/blog-tag.dto.ts` | `@ObjectType({ description: '标签' })` → `@ObjectType('BlogTag', { description: '标签' })` |
| `src/adapters/api/graphql/blog/dto/blog-category.dto.ts` | `@ObjectType({ description: '分类' })` → `@ObjectType('BlogCategory', { description: '分类' })` |

### 验证方式

修改后重启后端，查询 GraphQL Schema 确认类型名已变更：

```bash
curl -s http://localhost:3000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name } } }"}' \
  | python3 -c "import sys,json; data=json.load(sys.stdin); names=[t['name'] for t in data['data']['__schema']['types'] if t['name'].startswith('Blog')]; print('\n'.join(sorted(names)))"
```

期望输出中包含 `BlogPost`、`BlogPostDetail`、`BlogComment` 等简短名称，不再有 `ObjectType` 后缀。

### 风险点

- 如果有其他服务或脚本依赖旧的类型名（如 `BlogPostObjectType`），需同步更新
- TypeScript 类名不变（仍为 `BlogPostObjectType`），仅 GraphQL Schema 中的类型名变更，不影响内部代码引用
