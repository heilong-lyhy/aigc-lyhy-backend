// src/modules/blog/blog.module.ts
// 博客领域模块：注册所有 blog entities、services、query services，导出 DI 依赖

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaginationModule } from '@modules/common/pagination.module';
import { BlogStorageModule } from '@src/infrastructure/blog-storage/blog-storage.module';
import { BlogPostEntity } from './entities/blog-post.entity';
import { BlogCategoryEntity } from './entities/blog-category.entity';
import { BlogTagEntity } from './entities/blog-tag.entity';
import { BlogPostTagEntity } from './entities/blog-post-tag.entity';
import { BlogCommentEntity } from './entities/blog-comment.entity';
import { BlogLikeEntity } from './entities/blog-like.entity';
import { BlogFileEntity } from './entities/blog-file.entity';
import { BlogProfileEntity } from './entities/blog-profile.entity';
import { BlogFriendLinkEntity } from './entities/blog-friend-link.entity';
import { BlogPostService } from './blog-post.service';
import { BlogCategoryService } from './blog-category.service';
import { BlogPostTagService } from './blog-post-tag.service';
import { BlogTagService } from './blog-tag.service';
import { BlogCommentService } from './blog-comment.service';
import { BlogLikeService } from './blog-like.service';
import { BlogFileService } from './blog-file.service';
import { BlogProfileService } from './blog-profile.service';
import { BlogFriendLinkService } from './blog-friend-link.service';
import { BlogPostQueryService } from './queries/blog-post.query.service';
import { BlogCategoryQueryService } from './queries/blog-category.query.service';
import { BlogTagQueryService } from './queries/blog-tag.query.service';
import { BlogCommentQueryService } from './queries/blog-comment.query.service';
import { BlogLikeQueryService } from './queries/blog-like.query.service';
import { BlogFileQueryService } from './queries/blog-file.query.service';
import { BlogProfileQueryService } from './queries/blog-profile.query.service';
import { BlogDashboardQueryService } from './queries/blog-dashboard.query.service';
import { BlogFriendLinkQueryService } from './queries/blog-friend-link.query.service';

const BLOG_ENTITIES = [
  BlogPostEntity,
  BlogCategoryEntity,
  BlogTagEntity,
  BlogPostTagEntity,
  BlogCommentEntity,
  BlogLikeEntity,
  BlogFileEntity,
  BlogProfileEntity,
  BlogFriendLinkEntity,
];

@Module({
  imports: [TypeOrmModule.forFeature(BLOG_ENTITIES), PaginationModule, BlogStorageModule],
  providers: [
    BlogPostService,
    BlogCategoryService,
    BlogPostTagService,
    BlogTagService,
    BlogCommentService,
    BlogLikeService,
    BlogFileService,
    BlogProfileService,
    BlogFriendLinkService,
    BlogPostQueryService,
    BlogCategoryQueryService,
    BlogTagQueryService,
    BlogCommentQueryService,
    BlogLikeQueryService,
    BlogFileQueryService,
    BlogProfileQueryService,
    BlogDashboardQueryService,
    BlogFriendLinkQueryService,
  ],
  exports: [
    TypeOrmModule,
    BlogPostService,
    BlogCategoryService,
    BlogPostTagService,
    BlogTagService,
    BlogCommentService,
    BlogLikeService,
    BlogFileService,
    BlogProfileService,
    BlogFriendLinkService,
    BlogPostQueryService,
    BlogCategoryQueryService,
    BlogTagQueryService,
    BlogCommentQueryService,
    BlogLikeQueryService,
    BlogFileQueryService,
    BlogProfileQueryService,
    BlogDashboardQueryService,
    BlogFriendLinkQueryService,
  ],
})
export class BlogModule {}
