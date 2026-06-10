// src/adapters/api/graphql/blog/blog-graphql-adapter.module.ts
// 博客 GraphQL 适配器模块：注册所有 blog resolvers，导入 BlogUsecasesModule

import { BlogUsecasesModule } from '@usecases/blog/blog-usecases.module';
import { Module } from '@nestjs/common';
import { BlogPostResolver } from './blog-post.resolver';
import { BlogCategoryResolver } from './blog-category.resolver';
import { BlogTagResolver } from './blog-tag.resolver';
import { BlogCommentResolver } from './blog-comment.resolver';
import { BlogLikeResolver } from './blog-like.resolver';
import { BlogFileResolver } from './blog-file.resolver';
import { BlogProfileResolver } from './blog-profile.resolver';
import { BlogDashboardResolver } from './blog-dashboard.resolver';
import { BlogFriendLinkResolver } from './blog-friend-link.resolver';

@Module({
  imports: [BlogUsecasesModule],
  providers: [
    BlogPostResolver,
    BlogCategoryResolver,
    BlogTagResolver,
    BlogCommentResolver,
    BlogLikeResolver,
    BlogFileResolver,
    BlogProfileResolver,
    BlogDashboardResolver,
    BlogFriendLinkResolver,
  ],
  exports: [
    BlogPostResolver,
    BlogCategoryResolver,
    BlogTagResolver,
    BlogCommentResolver,
    BlogLikeResolver,
    BlogFileResolver,
    BlogProfileResolver,
    BlogDashboardResolver,
    BlogFriendLinkResolver,
  ],
})
export class BlogGraphQLAdapterModule {}
