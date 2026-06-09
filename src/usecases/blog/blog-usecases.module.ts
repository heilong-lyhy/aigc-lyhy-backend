// src/usecases/blog/blog-usecases.module.ts
// 博客领域 Usecases 模块：注册所有 blog usecases，导入 BlogModule
// change-blog-admin-password 跨域依赖 AccountModule

import { AccountModule } from '@src/modules/account/account.module';
import { BlogModule } from '@src/modules/blog/blog.module';
import { PaginationModule } from '@src/modules/common/pagination.module';
import { Module } from '@nestjs/common';
import { CreateBlogPostUsecase } from '@src/usecases/blog/create-blog-post.usecase';
import { UpdateBlogPostUsecase } from '@src/usecases/blog/update-blog-post.usecase';
import { DeleteBlogPostUsecase } from '@src/usecases/blog/delete-blog-post.usecase';
import { PublishBlogPostUsecase } from '@src/usecases/blog/publish-blog-post.usecase';
import { ToggleBlogPostLikeUsecase } from '@src/usecases/blog/toggle-blog-post-like.usecase';
import { CreateBlogCategoryUsecase } from '@src/usecases/blog/create-blog-category.usecase';
import { UpdateBlogCategoryUsecase } from '@src/usecases/blog/update-blog-category.usecase';
import { DeleteBlogCategoryUsecase } from '@src/usecases/blog/delete-blog-category.usecase';
import { CreateBlogTagUsecase } from '@src/usecases/blog/create-blog-tag.usecase';
import { UpdateBlogTagUsecase } from '@src/usecases/blog/update-blog-tag.usecase';
import { DeleteBlogTagUsecase } from '@src/usecases/blog/delete-blog-tag.usecase';
import { CreateBlogCommentUsecase } from '@src/usecases/blog/create-blog-comment.usecase';
import { UpdateBlogCommentStatusUsecase } from '@src/usecases/blog/update-blog-comment-status.usecase';
import { BatchUpdateBlogCommentStatusUsecase } from '@src/usecases/blog/batch-update-blog-comment-status.usecase';
import { DeleteBlogCommentUsecase } from '@src/usecases/blog/delete-blog-comment.usecase';
import { UploadBlogFileUsecase } from '@src/usecases/blog/upload-blog-file.usecase';
import { DeleteBlogFileUsecase } from '@src/usecases/blog/delete-blog-file.usecase';
import { UpdateBlogProfileUsecase } from '@src/usecases/blog/update-blog-profile.usecase';
import { ChangeBlogAdminPasswordUsecase } from '@src/usecases/blog/change-blog-admin-password.usecase';
import {
  GetBlogPostByIdUsecase,
  GetBlogPostBySlugUsecase,
  ListBlogPostsUsecase,
  ListBlogPublishedPostsUsecase,
  ListBlogCategoriesUsecase,
  GetBlogCategoryTreeUsecase,
  ListBlogTagsUsecase,
  ListBlogCommentsUsecase,
  ListBlogCommentsByPostUsecase,
  HasLikedBlogPostUsecase,
  ListBlogFilesUsecase,
  GetBlogProfileUsecase,
  GetBlogDashboardStatsUsecase,
} from '@src/usecases/blog/blog-read.usecase';

@Module({
  imports: [BlogModule, AccountModule.forRoot(), PaginationModule],
  providers: [
    // 写 usecases
    CreateBlogPostUsecase,
    UpdateBlogPostUsecase,
    DeleteBlogPostUsecase,
    PublishBlogPostUsecase,
    ToggleBlogPostLikeUsecase,
    CreateBlogCategoryUsecase,
    UpdateBlogCategoryUsecase,
    DeleteBlogCategoryUsecase,
    CreateBlogTagUsecase,
    UpdateBlogTagUsecase,
    DeleteBlogTagUsecase,
    CreateBlogCommentUsecase,
    UpdateBlogCommentStatusUsecase,
    BatchUpdateBlogCommentStatusUsecase,
    DeleteBlogCommentUsecase,
    UploadBlogFileUsecase,
    DeleteBlogFileUsecase,
    UpdateBlogProfileUsecase,
    ChangeBlogAdminPasswordUsecase,
    // 读 usecases
    GetBlogPostByIdUsecase,
    GetBlogPostBySlugUsecase,
    ListBlogPostsUsecase,
    ListBlogPublishedPostsUsecase,
    ListBlogCategoriesUsecase,
    GetBlogCategoryTreeUsecase,
    ListBlogTagsUsecase,
    ListBlogCommentsUsecase,
    ListBlogCommentsByPostUsecase,
    HasLikedBlogPostUsecase,
    ListBlogFilesUsecase,
    GetBlogProfileUsecase,
    GetBlogDashboardStatsUsecase,
  ],
  exports: [
    // 写 usecases
    CreateBlogPostUsecase,
    UpdateBlogPostUsecase,
    DeleteBlogPostUsecase,
    PublishBlogPostUsecase,
    ToggleBlogPostLikeUsecase,
    CreateBlogCategoryUsecase,
    UpdateBlogCategoryUsecase,
    DeleteBlogCategoryUsecase,
    CreateBlogTagUsecase,
    UpdateBlogTagUsecase,
    DeleteBlogTagUsecase,
    CreateBlogCommentUsecase,
    UpdateBlogCommentStatusUsecase,
    BatchUpdateBlogCommentStatusUsecase,
    DeleteBlogCommentUsecase,
    UploadBlogFileUsecase,
    DeleteBlogFileUsecase,
    UpdateBlogProfileUsecase,
    ChangeBlogAdminPasswordUsecase,
    // 读 usecases
    GetBlogPostByIdUsecase,
    GetBlogPostBySlugUsecase,
    ListBlogPostsUsecase,
    ListBlogPublishedPostsUsecase,
    ListBlogCategoriesUsecase,
    GetBlogCategoryTreeUsecase,
    ListBlogTagsUsecase,
    ListBlogCommentsUsecase,
    ListBlogCommentsByPostUsecase,
    HasLikedBlogPostUsecase,
    ListBlogFilesUsecase,
    GetBlogProfileUsecase,
    GetBlogDashboardStatsUsecase,
  ],
})
export class BlogUsecasesModule {}
