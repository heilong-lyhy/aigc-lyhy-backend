// src/usecases/blog/blog-usecases.module.ts
// 博客领域 Usecases 模块：注册所有 blog usecases，导入 BlogModule
// change-blog-admin-password 跨域依赖 AccountModule

import { AccountModule } from '@modules/account/account.module';
import { BlogModule } from '@modules/blog/blog.module';
import { PaginationModule } from '@modules/common/pagination.module';
import { Module } from '@nestjs/common';
import { CreateBlogPostUsecase } from '@usecases/blog/create-blog-post.usecase';
import { UpdateBlogPostUsecase } from '@usecases/blog/update-blog-post.usecase';
import { DeleteBlogPostUsecase } from '@usecases/blog/delete-blog-post.usecase';
import { RestoreBlogPostUsecase } from '@usecases/blog/restore-blog-post.usecase';
import { PermanentDeleteBlogPostUsecase } from '@usecases/blog/permanent-delete-blog-post.usecase';
import { ListDeletedBlogPostsUsecase } from '@usecases/blog/list-deleted-blog-posts.usecase';
import { PublishBlogPostUsecase } from '@usecases/blog/publish-blog-post.usecase';
import { ToggleBlogPostLikeUsecase } from '@usecases/blog/toggle-blog-post-like.usecase';
import { CreateBlogCategoryUsecase } from '@usecases/blog/create-blog-category.usecase';
import { UpdateBlogCategoryUsecase } from '@usecases/blog/update-blog-category.usecase';
import { DeleteBlogCategoryUsecase } from '@usecases/blog/delete-blog-category.usecase';
import { CreateBlogTagUsecase } from '@usecases/blog/create-blog-tag.usecase';
import { UpdateBlogTagUsecase } from '@usecases/blog/update-blog-tag.usecase';
import { DeleteBlogTagUsecase } from '@usecases/blog/delete-blog-tag.usecase';
import { CreateBlogCommentUsecase } from '@usecases/blog/create-blog-comment.usecase';
import { CreateBlogCommentByUserUsecase } from '@usecases/blog/create-blog-comment-by-user.usecase';
import { UpdateBlogCommentStatusUsecase } from '@usecases/blog/update-blog-comment-status.usecase';
import { BatchUpdateBlogCommentStatusUsecase } from '@usecases/blog/batch-update-blog-comment-status.usecase';
import { DeleteBlogCommentUsecase } from '@usecases/blog/delete-blog-comment.usecase';
import { ReplyBlogCommentUsecase } from '@usecases/blog/reply-blog-comment.usecase';
import { HideBlogCommentUsecase } from '@usecases/blog/hide-blog-comment.usecase';
import { UnhideBlogCommentUsecase } from '@usecases/blog/unhide-blog-comment.usecase';
import { CreateBlogFriendLinkUsecase } from '@usecases/blog/create-blog-friend-link.usecase';
import { UpdateBlogFriendLinkUsecase } from '@usecases/blog/update-blog-friend-link.usecase';
import { DeleteBlogFriendLinkUsecase } from '@usecases/blog/delete-blog-friend-link.usecase';
import { UploadBlogFileUsecase } from '@usecases/blog/upload-blog-file.usecase';
import { DeleteBlogFileUsecase } from '@usecases/blog/delete-blog-file.usecase';
import { UpdateBlogProfileUsecase } from '@usecases/blog/update-blog-profile.usecase';
import { ChangeBlogAdminPasswordUsecase } from '@usecases/blog/change-blog-admin-password.usecase';
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
  ListBlogFriendLinksUsecase,
  ListAllBlogFriendLinksUsecase,
} from '@usecases/blog/blog-read.usecase';

@Module({
  imports: [BlogModule, AccountModule.forRoot(), PaginationModule],
  providers: [
    // 写 usecases
    CreateBlogPostUsecase,
    UpdateBlogPostUsecase,
    DeleteBlogPostUsecase,
    RestoreBlogPostUsecase,
    PermanentDeleteBlogPostUsecase,
    ListDeletedBlogPostsUsecase,
    PublishBlogPostUsecase,
    ToggleBlogPostLikeUsecase,
    CreateBlogCategoryUsecase,
    UpdateBlogCategoryUsecase,
    DeleteBlogCategoryUsecase,
    CreateBlogTagUsecase,
    UpdateBlogTagUsecase,
    DeleteBlogTagUsecase,
    CreateBlogCommentUsecase,
    CreateBlogCommentByUserUsecase,
    UpdateBlogCommentStatusUsecase,
    BatchUpdateBlogCommentStatusUsecase,
    DeleteBlogCommentUsecase,
    ReplyBlogCommentUsecase,
    HideBlogCommentUsecase,
    UnhideBlogCommentUsecase,
    CreateBlogFriendLinkUsecase,
    UpdateBlogFriendLinkUsecase,
    DeleteBlogFriendLinkUsecase,
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
    ListBlogFriendLinksUsecase,
    ListAllBlogFriendLinksUsecase,
  ],
  exports: [
    // 写 usecases
    CreateBlogPostUsecase,
    UpdateBlogPostUsecase,
    DeleteBlogPostUsecase,
    RestoreBlogPostUsecase,
    PermanentDeleteBlogPostUsecase,
    ListDeletedBlogPostsUsecase,
    PublishBlogPostUsecase,
    ToggleBlogPostLikeUsecase,
    CreateBlogCategoryUsecase,
    UpdateBlogCategoryUsecase,
    DeleteBlogCategoryUsecase,
    CreateBlogTagUsecase,
    UpdateBlogTagUsecase,
    DeleteBlogTagUsecase,
    CreateBlogCommentUsecase,
    CreateBlogCommentByUserUsecase,
    UpdateBlogCommentStatusUsecase,
    BatchUpdateBlogCommentStatusUsecase,
    DeleteBlogCommentUsecase,
    ReplyBlogCommentUsecase,
    HideBlogCommentUsecase,
    UnhideBlogCommentUsecase,
    CreateBlogFriendLinkUsecase,
    UpdateBlogFriendLinkUsecase,
    DeleteBlogFriendLinkUsecase,
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
    ListBlogFriendLinksUsecase,
    ListAllBlogFriendLinksUsecase,
  ],
})
export class BlogUsecasesModule {}
