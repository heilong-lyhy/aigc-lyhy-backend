// src/usecases/blog/blog-usecases.module.ts
// 博客领域 Usecases 模块：注册所有 blog usecases，导入 BlogModule

import { BlogModule } from '@src/modules/blog/blog.module';
import { Module } from '@nestjs/common';
import { CreateBlogPostUsecase } from '@src/usecases/blog/create-blog-post.usecase';
import { UpdateBlogPostUsecase } from '@src/usecases/blog/update-blog-post.usecase';
import { DeleteBlogPostUsecase } from '@src/usecases/blog/delete-blog-post.usecase';
import { PublishBlogPostUsecase } from '@src/usecases/blog/publish-blog-post.usecase';
import { ToggleBlogPostLikeUsecase } from '@src/usecases/blog/toggle-blog-post-like.usecase';

@Module({
  imports: [BlogModule],
  providers: [
    CreateBlogPostUsecase,
    UpdateBlogPostUsecase,
    DeleteBlogPostUsecase,
    PublishBlogPostUsecase,
    ToggleBlogPostLikeUsecase,
  ],
  exports: [
    CreateBlogPostUsecase,
    UpdateBlogPostUsecase,
    DeleteBlogPostUsecase,
    PublishBlogPostUsecase,
    ToggleBlogPostLikeUsecase,
  ],
})
export class BlogUsecasesModule {}
