## v1.4.0 框架升级更新日志
升级结果：成功，95.8% 框架文件与模板完全一致。

### 本次修复
- 恢复 PaginationService 命名 ：之前为规避 ESLint 规则将其重命名为 PaginationQueryService ，偏离模板。现已恢复为 pagination.service.ts + PaginationService ，并在 eslint.config.mjs 的 isMixedServiceFilePath() 中添加白名单豁免（该服务为纯只读分页，非 mixed service）。
### 对齐确认
- 17 个混合修改文件均正确融合了框架 v1.4.0 更新与业务代码，无遗漏、无丢失
- enum.registry.ts + schema.init.ts 的"双源真相"重构已采纳
- 所有框架依赖版本一致，业务依赖（throttler/helmet/graphql-upload/sanitize-html）正常保留
- 配置文件（tsconfig/jest/nest-cli）完全一致，无冲突标记残留
### 后续维护注意
1. 混合文件中的 [MERGED] / [KEPT:业务保留] 标注建议保留，便于未来升级定位
2. env.helpers.ts 为自行提取，模板无此文件，若模板后续也做类似提取需注意对齐
3. database.config.ts 中 getIntEnvWithDefault 的导入方式与模板不同（导入 vs 内联），功能等价但需关注模板逻辑变更

## v1.6.0 框架升级更新日志
升级结果：成功，前后端编译 0 错误、ESLint 0 错误、前后端均可正常启动。

### 本次修复
- 统一 BullMQ 队列常量：修正 types/worker/bullmq.types.ts 中 MAGIC_ITEM_CRAFT 的值从 'magic_item_craft'(下划线) 为 'magic-item-craft'(短横线)，与运行时注册一致；infrastructure/bullmq/bullmq.constants.ts 改为从 types 层 re-export，消除二次定义
- 迁移 modules 层 BullMQ 导入：6 个 modules 文件从 @src/infrastructure/bullmq/bullmq.constants 迁移到 @app-types/worker/bullmq.types，消除 modules → infrastructure 常量依赖
- 迁移 adapter 层 BullMQ 导入：2 个 worker adapter 文件从 infrastructure 导入迁移到 @app-types/worker/bullmq.types
- 修正 env.development 端口：APP_PORT 从 3000 改为 16200，确保开发模式使用指定端口
- Capability 新旧模式清理：删除旧 CapabilityManifestProvider 相关文件，reference 模块迁移到新 CapabilityAnchorProvider 模式
- 删除孤立代码：移除无引用的 nest-capability-package.ts
- 旧 CapabilityManifest 类型清理：从 types/common/capability.types.ts 移除

### 对齐确认
- 后端依赖方向：adapters → infrastructure 仅剩 3 处已知偏差（capability runtime contract type import、spec 文件、restoreCapabilityEnvelope 值导入），均合规或有标注
- 前端依赖方向：shared/entities/features 无反向依赖，app/router 依赖 labs/sandbox 为文档允许例外
- 无 ORM Entity 污染：modules 下无 GraphQL/HTTP/Swagger 装饰器
- 无 QueryService 写操作
- 无 ConfigService/process.env 在 service 中直接使用
- 无 *.port.ts 文件
- 无 *TransactionManager alias 新增
- 无 Git 冲突标记残留
- 无 CapabilityManifestProvider 旧模式残留
- CapabilityOperationHandler 双定义：types 层（宽松版）与 contract 层（精确版）共存，types 层已注释说明
- 前后端 TypeScript 编译 0 错误
- 前后端 ESLint 0 错误
- 前端 http://localhost:16100 返回 200
- 后端 http://localhost:16200/health 返回 200

### 后续维护注意
1. getTransactionEntityManager 兼容别名仍在 types 层 re-export，blog 模块广泛使用旧名称，需逐步迁移到 getTypeOrmEntityManager
2. restoreCapabilityEnvelope 从 infrastructure 导入到 worker adapter，属于技术性 transport 反序列化函数，后续可考虑提升为 usecase contract
3. CapabilityOperationHandler 在 types 层和 capability-bus.contract.ts 各有一份定义，后续应统一到 types 层并添加可选 signal? 字段
4. QUEUE_PRODUCER DI token 未被任何模块绑定，magic-item-craft-queue.service.ts 可能是未完成功能
5. 混合文件中的 [KEPT:业务保留] / [MERGED] 标注继续保留，便于未来升级定位

## v1.6.1 框架升级更新日志
升级结果：成功，前后端编译 0 错误、ESLint 0 错误、前后端均可正常启动，业务模块（blog/magic-item-craft）GraphQL API 完整可用。

### 本次修复
- 恢复 BlogGraphQLAdapterModule 注册：模板覆盖导致 graphql-adapter.module.ts 丢失对 BlogGraphQLAdapterModule 的导入与注册，博客相关 9 个 Resolver（BlogPost/Category/Tag/Comment/Like/File/Profile/Dashboard/FriendLink）无法进入 GraphQL schema。现已恢复 import 与 imports 数组注册，并加 [KEPT:业务保留] 标注
- 恢复 MagicItemCraftResolver 注册：模板覆盖导致 graphql-adapter.module.ts 丢失 MagicItemCraftResolver 的 provider/export 注册。现已恢复 provider 与 exports 注册，并补充 MagicItemCraftUsecasesModule 导入，加 [KEPT:业务保留] 标注
- 修复 MagicItemCraftQueueService 依赖注入：原实现注入 QUEUE_PRODUCER token，但该 token 从未被任何模块绑定（v1.6.0 日志已记录此未完成功能）。现改为直接注入 BullMqProducerGateway，与 EmailQueueService 保持一致，启动时不再报 "Cannot resolve dependencies of MagicItemCraftQueueService" 错误
- 注册 blog 与 magic-item-craft 枚举：enum.registry.ts 缺少 BlogPostStatus / BlogCommentStatus / BlogFileType / MagicItemCraftTaskStatus / MagicItemCraftTaskType / MagicItemCraftTaskQualityLevel 的 registerEnumType 调用，导致 GraphQL schema 构建时抛出 CannotDetermineInputTypeError。现已补齐 6 个枚举注册

### 对齐确认
- 后端 TypeScript 编译 0 错误（tsc -p tsconfig.build.json --noEmit 通过）
- 后端 ESLint 0 错误（npm run lint 通过，仅 seed-blog.ts 脚本 13 个 console warning 非阻塞）
- capability docs check 通过、usecase normalize guard 通过、eslint architecture fixtures 通过
- 后端 http://localhost:16200/health 返回 200，status=ok
- 后端 GraphQL endpoint POST 返回 200
- GraphQL Query 字段从 8 个增加到 25 个，blogAllFriendLinks/blogCategories/blogCategoryTree/blogComments/blogCommentsByPost/blogDashboardStats/blogDeletedPosts/blogFiles/blogFriendLinks/blogPost/blogPostBySlug/blogPosts/blogProfile/blogPublishedPosts/blogTags/hasLikedBlogPost/magicItemCraftTask 等业务字段全部暴露
- GraphQL Mutation 字段 46 个，createBlogPost/createBlogComment/createMagicItemCraftTask/updateBlogPost/deleteBlogPost/publishBlogPost/toggleBlogPostLike/uploadBlogFile 等业务 mutation 全部暴露
- 前端 http://localhost:16100 返回 200，Vite 开发服务器正常
- BlogGraphQLAdapterModule / MagicItemCraftUsecasesModule / MagicItemCraftResolver 均在 GraphQLAdapterModule 正确注册
- blog 与 magic-item-craft 相关 6 个枚举在 enum.registry.ts 注册，GraphQL schema 构建无 CannotDetermineInputTypeError

### 后续维护注意
1. graphql-adapter.module.ts 中 BlogGraphQLAdapterModule 与 MagicItemCraftResolver 的注册带有 [KEPT:业务保留] 标注，未来模板升级时需保留这两处业务注册
2. enum.registry.ts 中 blog 与 magic-item-craft 枚举注册带有 [KEPT:业务保留] 标注，未来模板升级时需保留
3. MagicItemCraftQueueService 现直接依赖 BullMqProducerGateway（具体类）而非 QUEUE_PRODUCER token（抽象端口），与 EmailQueueService 实现风格一致，但偏离了 usecase/common/ports/queue-producer.contract.ts 的端口抽象意图。若未来模板启用了 QUEUE_PRODUCER token 绑定，需统一迁移回 token 注入
4. v1.6.0 日志中"QUEUE_PRODUCER DI token 未被任何模块绑定"的遗留问题已通过本次改为直接注入 BullMqProducerGateway 绕过，但 QUEUE_PRODUCER contract 文件本身仍保留未删除，后续可关注模板是否启用该 token
5. 混合文件中的 [KEPT:业务保留] / [MERGED] 标注继续保留，便于未来升级定位
