// src/usecases/blog/list-deleted-blog-posts.usecase.ts
// 列出已删除文章用例：供管理端回收站使用
// 分页逻辑在 usecase 层编排 PaginationService，QueryService 只提供基础读取与视图映射

import { Injectable } from '@nestjs/common';
import type { PaginatedResult } from '@core/pagination/pagination.types';
import type { BlogPostView } from '@modules/blog/blog.types';
import {
  BlogPostQueryService,
  type BlogPostPaginationParams,
} from '@modules/blog/queries/blog-post.query.service';
import { PaginationService } from '@modules/common/pagination.service';

@Injectable()
export class ListDeletedBlogPostsUsecase {
  constructor(
    private readonly postQueryService: BlogPostQueryService,
    private readonly paginationService: PaginationService,
  ) {}

  async execute(params: BlogPostPaginationParams): Promise<PaginatedResult<BlogPostView>> {
    const qb = this.postQueryService.createDeletedPostsQueryBuilder(params);

    const result = await this.paginationService.paginateQuery({
      qb,
      params: {
        mode: 'OFFSET',
        page: params.page,
        pageSize: params.pageSize,
        withTotal: true,
        sorts: params.sortBy
          ? [{ field: params.sortBy, direction: params.sortOrder ?? 'DESC' }]
          : [{ field: 'deletedAt', direction: 'DESC' }],
      },
      allowedSorts: ['deletedAt', 'createdAt', 'title'],
      defaultSorts: [{ field: 'deletedAt', direction: 'DESC' }],
      resolveColumn: (field: string) => {
        const columnMap: Record<string, string> = {
          deletedAt: 'post.deleted_at',
          createdAt: 'post.created_at',
          title: 'post.title',
        };
        return columnMap[field] ?? null;
      },
    });

    const ids = result.items.map((e) => e.id);
    const views =
      ids.length > 0 ? await this.postQueryService.findDeletedPostsByIdsForViewMapping(ids) : [];

    return {
      ...result,
      items: views,
    };
  }
}
