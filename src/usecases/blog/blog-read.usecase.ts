// src/usecases/blog/blog-read.usecase.ts
// 博客读操作 usecases：封装 QueryService 调用，供 adapter 层通过 usecases 依赖调用
// 分页逻辑在 usecase 层编排 PaginationService，QueryService 只提供基础读取与视图映射
// 遵守依赖方向：adapters → usecases → modules

import { Injectable } from '@nestjs/common';
import { BlogPostStatus } from '@app-types/models/blog.types';
import {
  BlogPostQueryService,
  type BlogPostPaginationParams,
} from '@src/modules/blog/queries/blog-post.query.service';
import { BlogCategoryQueryService } from '@src/modules/blog/queries/blog-category.query.service';
import { BlogTagQueryService } from '@src/modules/blog/queries/blog-tag.query.service';
import {
  BlogCommentQueryService,
  type BlogCommentPaginationParams,
  type BlogCommentByPostPaginationParams,
} from '@src/modules/blog/queries/blog-comment.query.service';
import { BlogLikeQueryService } from '@src/modules/blog/queries/blog-like.query.service';
import {
  BlogFileQueryService,
  type BlogFilePaginationParams,
} from '@src/modules/blog/queries/blog-file.query.service';
import { BlogProfileQueryService } from '@src/modules/blog/queries/blog-profile.query.service';
import { BlogDashboardQueryService } from '@src/modules/blog/queries/blog-dashboard.query.service';
import { PaginationService } from '@src/modules/common/pagination.service';
import type {
  BlogPostView,
  BlogPostDetailView,
  BlogCategoryView,
  BlogCategoryTreeView,
  BlogTagView,
  BlogCommentView,
  BlogFileView,
  BlogProfileView,
  BlogDashboardView,
} from '@src/modules/blog/blog.types';
import type { PaginatedResult } from '@core/pagination/pagination.types';

// ─── 文章读 ───

/** 文章分页排序字段 → 数据库列名映射 */
const POST_SORT_COLUMN_MAP: Record<string, string> = {
  createdAt: 'post.created_at',
  publishedAt: 'post.published_at',
  viewCount: 'post.view_count',
  likeCount: 'post.like_count',
  title: 'post.title',
};

const POST_ALLOWED_SORTS = ['createdAt', 'publishedAt', 'viewCount', 'likeCount', 'title'];
const POST_DEFAULT_SORTS = [{ field: 'createdAt', direction: 'DESC' as const }];

@Injectable()
export class GetBlogPostByIdUsecase {
  constructor(private readonly postQueryService: BlogPostQueryService) {}

  async execute(
    id: number,
    options?: { publishedOnly?: boolean },
  ): Promise<BlogPostDetailView | null> {
    const view = await this.postQueryService.findPostById(id);
    if (!view) return null;
    if (options?.publishedOnly && view.status !== BlogPostStatus.PUBLISHED) return null;
    return view;
  }
}

@Injectable()
export class GetBlogPostBySlugUsecase {
  constructor(private readonly postQueryService: BlogPostQueryService) {}

  async execute(
    slug: string,
    options?: { publishedOnly?: boolean },
  ): Promise<BlogPostDetailView | null> {
    const view = await this.postQueryService.findPostBySlug(slug);
    if (!view) return null;
    if (options?.publishedOnly && view.status !== BlogPostStatus.PUBLISHED) return null;
    return view;
  }
}

@Injectable()
export class ListBlogPostsUsecase {
  constructor(
    private readonly postQueryService: BlogPostQueryService,
    private readonly paginationService: PaginationService,
  ) {}

  async execute(params: BlogPostPaginationParams): Promise<PaginatedResult<BlogPostView>> {
    const qb = this.postQueryService.createPostQueryBuilder(params);

    const result = await this.paginationService.paginateQuery({
      qb,
      params: {
        mode: 'OFFSET',
        page: params.page,
        pageSize: params.pageSize,
        withTotal: true,
        sorts: params.sortBy
          ? [{ field: params.sortBy, direction: params.sortOrder ?? 'DESC' }]
          : [{ field: 'createdAt', direction: 'DESC' }],
      },
      allowedSorts: POST_ALLOWED_SORTS,
      defaultSorts: POST_DEFAULT_SORTS,
      resolveColumn: (field: string) => POST_SORT_COLUMN_MAP[field] ?? null,
    });

    const ids = result.items.map((e) => e.id);
    const views =
      ids.length > 0 ? await this.postQueryService.findPostsByIdsForViewMapping(ids) : [];

    return {
      ...result,
      items: views,
    };
  }
}

@Injectable()
export class ListBlogPublishedPostsUsecase {
  constructor(private readonly listBlogPostsUsecase: ListBlogPostsUsecase) {}

  async execute(
    params: Omit<BlogPostPaginationParams, 'status'>,
  ): Promise<PaginatedResult<BlogPostView>> {
    return this.listBlogPostsUsecase.execute({
      ...params,
      status: BlogPostStatus.PUBLISHED,
    });
  }
}

// ─── 分类读 ───

@Injectable()
export class ListBlogCategoriesUsecase {
  constructor(private readonly categoryQueryService: BlogCategoryQueryService) {}

  async execute(): Promise<BlogCategoryView[]> {
    return this.categoryQueryService.listAllCategories();
  }
}

@Injectable()
export class GetBlogCategoryTreeUsecase {
  constructor(private readonly categoryQueryService: BlogCategoryQueryService) {}

  async execute(): Promise<BlogCategoryTreeView[]> {
    return this.categoryQueryService.getCategoryTree();
  }
}

// ─── 标签读 ───

@Injectable()
export class ListBlogTagsUsecase {
  constructor(private readonly tagQueryService: BlogTagQueryService) {}

  async execute(): Promise<BlogTagView[]> {
    return this.tagQueryService.listAllTags();
  }
}

// ─── 评论读 ───

@Injectable()
export class ListBlogCommentsUsecase {
  constructor(
    private readonly commentQueryService: BlogCommentQueryService,
    private readonly paginationService: PaginationService,
  ) {}

  async execute(params: BlogCommentPaginationParams): Promise<PaginatedResult<BlogCommentView>> {
    const qb = this.commentQueryService.createCommentQueryBuilder(params);

    const result = await this.paginationService.paginateQuery({
      qb,
      params: {
        mode: 'OFFSET',
        page: params.page,
        pageSize: params.pageSize,
        withTotal: true,
        sorts: params.sortBy
          ? [{ field: params.sortBy, direction: params.sortOrder ?? 'DESC' }]
          : [{ field: 'createdAt', direction: 'DESC' }],
      },
      allowedSorts: ['createdAt', 'updatedAt'],
      defaultSorts: [{ field: 'createdAt', direction: 'DESC' }],
      resolveColumn: (field: string) => {
        const columnMap: Record<string, string> = {
          createdAt: 'comment.created_at',
          updatedAt: 'comment.updated_at',
        };
        return columnMap[field] ?? null;
      },
    });

    return {
      ...result,
      items: result.items.map((e) => this.commentQueryService.toView(e)),
    };
  }
}

@Injectable()
export class ListBlogCommentsByPostUsecase {
  constructor(
    private readonly commentQueryService: BlogCommentQueryService,
    private readonly paginationService: PaginationService,
  ) {}

  async execute(
    params: BlogCommentByPostPaginationParams,
  ): Promise<PaginatedResult<BlogCommentView>> {
    const qb = this.commentQueryService.createCommentByPostQueryBuilder(params);

    const result = await this.paginationService.paginateQuery({
      qb,
      params: {
        mode: 'OFFSET',
        page: params.page,
        pageSize: params.pageSize,
        withTotal: true,
        sorts: params.sortBy
          ? [{ field: params.sortBy, direction: params.sortOrder ?? 'ASC' }]
          : [{ field: 'createdAt', direction: 'ASC' }],
      },
      allowedSorts: ['createdAt', 'updatedAt'],
      defaultSorts: [{ field: 'createdAt', direction: 'ASC' }],
      resolveColumn: (field: string) => {
        const columnMap: Record<string, string> = {
          createdAt: 'comment.created_at',
          updatedAt: 'comment.updated_at',
        };
        return columnMap[field] ?? null;
      },
    });

    return {
      ...result,
      items: result.items.map((e) => this.commentQueryService.toView(e)),
    };
  }
}

// ─── 点赞读 ───

@Injectable()
export class HasLikedBlogPostUsecase {
  constructor(private readonly likeQueryService: BlogLikeQueryService) {}

  async execute(postId: number, userIdentifier: string): Promise<boolean> {
    return this.likeQueryService.hasLiked(postId, userIdentifier);
  }
}

// ─── 文件读 ───

@Injectable()
export class ListBlogFilesUsecase {
  constructor(
    private readonly fileQueryService: BlogFileQueryService,
    private readonly paginationService: PaginationService,
  ) {}

  async execute(params: BlogFilePaginationParams): Promise<PaginatedResult<BlogFileView>> {
    const qb = this.fileQueryService.createFileQueryBuilder(params);

    const result = await this.paginationService.paginateQuery({
      qb,
      params: {
        mode: 'OFFSET',
        page: params.page,
        pageSize: params.pageSize,
        withTotal: true,
        sorts: params.sortBy
          ? [{ field: params.sortBy, direction: params.sortOrder ?? 'DESC' }]
          : [{ field: 'createdAt', direction: 'DESC' }],
      },
      allowedSorts: ['createdAt', 'updatedAt', 'fileSize'],
      defaultSorts: [{ field: 'createdAt', direction: 'DESC' }],
      resolveColumn: (field: string) => {
        const columnMap: Record<string, string> = {
          createdAt: 'file.created_at',
          updatedAt: 'file.updated_at',
          fileSize: 'file.file_size',
        };
        return columnMap[field] ?? null;
      },
    });

    return {
      ...result,
      items: result.items.map((e) => this.fileQueryService.toView(e)),
    };
  }
}

// ─── 博主信息读 ───

@Injectable()
export class GetBlogProfileUsecase {
  constructor(private readonly profileQueryService: BlogProfileQueryService) {}

  async execute(): Promise<BlogProfileView | null> {
    return this.profileQueryService.getProfile();
  }
}

// ─── 仪表盘统计读 ───

@Injectable()
export class GetBlogDashboardStatsUsecase {
  constructor(private readonly dashboardQueryService: BlogDashboardQueryService) {}

  async execute(): Promise<BlogDashboardView> {
    return this.dashboardQueryService.getDashboardStats();
  }
}
