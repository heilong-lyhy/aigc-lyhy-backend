// src/usecases/blog/list-deleted-blog-posts.usecase.ts
// 列出已删除文章用例：供管理端回收站使用
// 分页编排已下沉到 QueryService，usecase 只拿 PaginatedResult<BlogPostView>

import { Injectable } from '@nestjs/common';
import type { PaginatedResult } from '@core/pagination/pagination.types';
import type { BlogPostView } from '@modules/blog/blog.types';
import {
  BlogPostQueryService,
  type BlogPostPaginationParams,
} from '@modules/blog/queries/blog-post.query.service';

@Injectable()
export class ListDeletedBlogPostsUsecase {
  constructor(private readonly postQueryService: BlogPostQueryService) {}

  async execute(params: BlogPostPaginationParams): Promise<PaginatedResult<BlogPostView>> {
    return this.postQueryService.paginateDeletedPosts(params);
  }
}
