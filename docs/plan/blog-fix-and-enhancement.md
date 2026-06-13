# 博客功能修复与完善计划（后端部分）

> 创建时间：2026-06-13
> 状态：待执行

---

## 需求来源

用户提出的修改点、已知 Bug、缺失功能，经代码审查确认后的修复计划。

---

## 进度跟踪

| 任务 | 状态 | 阻塞项 | 备注 |
|------|------|--------|------|
| 1.1 注册用户仅分配 REGISTRANT | 已完成 | 无 | 已加固：强制忽略 type 参数，移除 RegisterInput.type 字段 |
| 1.2 关闭 Throttler 限流 | 已完成 | 无 | 已移除 APP_GUARD 全局注册 |
| 1.3 Blog 博主固定为 mahiru | 已完成 | 无 | 当前实现已满足，blog_profile 与用户系统独立 |
| 2.1 评论登录态 mutation | 已完成 | 无 | 新增 createBlogCommentByUser |
| 2.2 Blog profile 与 mahiru 关联 | 待执行 | 无 | 确认数据一致性 |

---

## 阶段一：配置与权限（P1）

### 1.1 注册用户仅分配 REGISTRANT 访问组

**问题**：用户要求注册用户仅分配 REGISTRANT 访问组，其他角色需管理员在数据库手动调整。

**当前状态**：
- `register-with-email.usecase.ts` 第 249 行 `mapRegisterTypeToRole`：`REGISTRANT` → `IdentityTypeEnum.REGISTRANT`
- `register.input.ts` 的 `type` 字段默认值为 `RegisterTypeEnum.REGISTRANT`
- 注册流程已正确分配 REGISTRANT 角色

**设计决策**：
- **当前实现已满足需求，无需修改**
- 注册接口的 `type` 参数虽有 `STAFF` 选项，但前端注册表单不会传递该值
- 如需更严格限制，可在 `RegisterWithEmailUsecase` 中强制忽略 `type` 参数，始终使用 `REGISTRANT`

**可选加固**：

| 文件 | 修改内容 |
|------|----------|
| `src/usecases/registration/register-with-email.usecase.ts` | `execute()` 中强制 `type = RegisterTypeEnum.REGISTRANT`，忽略外部传入的 `type` 参数 |
| `src/adapters/api/graphql/registration/dto/register.input.ts` | 移除 `type` 字段或设为 internal only |

**验收标准**：
- 新注册用户 accessGroup 仅为 `['REGISTRANT']`
- 无法通过 API 注册为 STAFF 或 ADMIN

### 1.2 关闭 Throttler 限流

**问题**：用户希望关闭 `ThrottlerException: Too Many Requests` 功能。

**当前状态**：
- `AppThrottlerModule` 注册了全局 `GqlThrottlerGuard`（`APP_GUARD`）
- 限流规则：short（60s/60次）、publicWrite（60s/10次）
- 测试环境已通过 `shouldSkip` 跳过

**设计决策**：
- 移除 `APP_GUARD` 注册，取消全局限流
- 保留 `ThrottlerModule` 和 `GqlThrottlerGuard` 代码，便于后续恢复
- 保留 `@Throttle` 和 `@SkipThrottle` 装饰器（不影响功能，仅作为文档标记）
- 如需恢复限流，重新注册 `APP_GUARD` 即可

**修改文件**：

| 文件 | 修改内容 |
|------|----------|
| `src/infrastructure/throttler/throttler.module.ts` | 移除 `providers` 中的 `APP_GUARD` 注册；保留 `ThrottlerModule.forRoot` 配置和 `GqlThrottlerGuard` 类定义 |

**验收标准**：
- 不再出现 `ThrottlerException: Too Many Requests`
- 正常请求不受限流影响
- `GqlThrottlerGuard` 类仍存在，可随时重新启用

### 1.3 Blog 博主固定为 mahiru 账号

**问题**：Blog 前台的博主信息应固定为 mahiru 账号，不随登录用户变化。

**当前状态**：
- `GetBlogProfileUsecase` 查询 `blog_profile` 表的第一条记录（`ORDER BY id ASC LIMIT 1`）
- `blog_profile` 表与用户账号系统独立，不关联 `user_account` 表
- 博主信息由管理员通过 `updateBlogProfile` mutation 维护

**设计决策**：
- **当前实现已满足需求，无需修改代码**
- `blog_profile` 表存储的是博客展示信息（昵称、简介、头像、社交链接），与登录用户无关
- 只需确保 `blog_profile` 表中有且仅有一条记录，对应 mahiru 的信息
- 建议在数据库初始化 migration 中插入 mahiru 的博主信息

**可选加固**：

| 文件 | 修改内容 |
|------|----------|
| 新增 migration | 插入 mahiru 的博主信息到 `blog_profile` 表（如尚无数据） |

**验收标准**：
- `blogProfile` query 始终返回 mahiru 的博主信息
- 切换登录账号不影响博主信息
- `updateBlogProfile` 仅 ADMIN 可调用

---

## 阶段二：评论登录态改造（P1）

### 2.1 新增 createBlogCommentByUser mutation

**问题**：前端删除评论表单中的昵称和邮箱输入框后，需要后端提供从 JWT context 获取用户信息的评论创建接口。

**当前状态**：
- `CreateBlogCommentInput` 要求 `authorName` 和 `authorEmail` 为必填
- `createBlogComment` mutation 是公开接口，不要求登录
- `replyBlogComment` mutation 需要 ADMIN 权限，从 JWT context 获取用户信息

**设计决策**：
- 新增 `createBlogCommentByUser` mutation，需要登录（`JwtAuthGuard`）
- 从 JWT context 的 `currentUser` 获取用户 ID，查询 `UserInfo` 获取 `nickname` 和 `email`
- 自动填充 `authorName`（nickname）和 `authorEmail`（email）
- 自动设置 `isAdminReply` 为用户是否为 ADMIN
- 保留原 `createBlogComment` mutation 不变（向后兼容，但前端不再使用）
- 新 mutation 仍受 `publicWrite` 限流保护（如果限流恢复）

**修改文件**：

| 文件 | 修改内容 |
|------|----------|
| 新建 `src/adapters/api/graphql/blog/dto/create-blog-comment-by-user.input.ts` | `CreateBlogCommentByUserInput`：`postId: Int!`、`content: String!`、`parentId: Int`、`replyToId: Int`（无 authorName/authorEmail） |
| `src/adapters/api/graphql/blog/blog-comment.resolver.ts` | 新增 `createBlogCommentByUser` mutation（`@UseGuards(JwtAuthGuard)`）；从 `currentUser` 获取用户信息；调用 `CreateBlogCommentUsecase` 并自动填充 authorName/authorEmail |
| `src/usecases/blog/create-blog-comment.usecase.ts` | 无需修改，已支持 authorName/authorEmail 参数 |

**验收标准**：
- 已登录用户调用 `createBlogCommentByUser` 成功创建评论
- `authorName` 和 `authorEmail` 自动从用户信息获取
- ADMIN 用户创建的评论 `isAdminReply` 为 true
- 未登录用户调用返回 `UNAUTHENTICATED` 错误
- 原有 `createBlogComment` mutation 不受影响

---

## 阶段三：数据一致性确认（P2）

### 3.1 确认 blog_profile 表数据

**问题**：确保 blog_profile 表中有 mahiru 的博主信息。

**设计决策**：
- 检查 `blog_profile` 表是否有数据
- 如无数据，通过 migration 或手动 SQL 插入
- 字段：nickname、bio、avatar_url、social_links

**验收标准**：
- `blogProfile` query 返回有效数据
- 数据与 mahiru 账号信息一致

---

## 自检清单

- [ ] `tsc --noEmit` 无错误
- [ ] `npm run test` 全部通过
- [ ] 注册用户 accessGroup 仅为 `['REGISTRANT']`
- [ ] 不再出现 `ThrottlerException`
- [ ] `blogProfile` query 返回 mahiru 的博主信息
- [ ] `createBlogCommentByUser` mutation 正常工作
- [ ] 未登录调用 `createBlogCommentByUser` 返回 `UNAUTHENTICATED`
- [ ] 原 `createBlogComment` mutation 不受影响
