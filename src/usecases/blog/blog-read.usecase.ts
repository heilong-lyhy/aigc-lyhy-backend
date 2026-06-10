// src/usecases/blog/blog-read.usecase.ts
// 博客读操作 usecases：封装 QueryService 调用，供 adapter 层通过 usecases 依赖调用
// 分页逻辑在 usecase 层编排 PaginationService，QueryService 只提供基础读取与视图映射
// 遵守依赖方向：adapters → usecases → modules

import { Injectable, Logger } from '@nestjs/common';
import { BlogPostStatus } from '@app-types/models/blog.types';
import {
  BlogPostQueryService,
  type BlogPostPaginationParams,
} from '@modules/blog/queries/blog-post.query.service';
import { BlogPostService } from '@modules/blog/blog-post.service';
import { BlogCategoryQueryService } from '@modules/blog/queries/blog-category.query.service';
import { BlogTagQueryService } from '@modules/blog/queries/blog-tag.query.service';
import {
  BlogCommentQueryService,
  type BlogCommentPaginationParams,
  type BlogCommentByPostPaginationParams,
} from '@modules/blog/queries/blog-comment.query.service';
import { BlogLikeQueryService } from '@modules/blog/queries/blog-like.query.service';
import {
  BlogFileQueryService,
  type BlogFilePaginationParams,
} from '@modules/blog/queries/blog-file.query.service';
import { BlogProfileQueryService } from '@modules/blog/queries/blog-profile.query.service';
import { BlogDashboardQueryService } from '@modules/blog/queries/blog-dashboard.query.service';
import { BlogFriendLinkQueryService } from '@modules/blog/queries/blog-friend-link.query.service';
import { PaginationService } from '@modules/common/pagination.service';
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
  BlogFriendLinkView,
} from '@modules/blog/blog.types';
import type { PaginatedResult } from '@core/pagination/pagination.types';

// ─── 文章读 ───

/** 文章分页排序字段 → 数据库列名映射 */
const POST_SORT_COLUMN_MAP: Record<string, string> = {
  isPinned: 'post.is_pinned',
  createdAt: 'post.created_at',
  publishedAt: 'post.published_at',
  viewCount: 'post.view_count',
  likeCount: 'post.like_count',
  title: 'post.title',
};

const POST_ALLOWED_SORTS = ['isPinned', 'createdAt', 'publishedAt', 'viewCount', 'likeCount', 'title'];
const POST_DEFAULT_SORTS = [
  { field: 'isPinned', direction: 'DESC' as const },
  { field: 'createdAt', direction: 'DESC' as const },
];

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
  private readonly logger = new Logger(GetBlogPostBySlugUsecase.name);

  constructor(
    private readonly postQueryService: BlogPostQueryService,
    private readonly postService: BlogPostService,
  ) {}

  async execute(
    slug: string,
    options?: { publishedOnly?: boolean },
  ): Promise<BlogPostDetailView | null> {
    const view = await this.postQueryService.findPostBySlug(slug);
    if (!view) return null;
    if (options?.publishedOnly && view.status !== BlogPostStatus.PUBLISHED) return null;

    // 阅读量自增：仅公开端（publishedOnly）触发，fire-and-forget，失败不影响详情返回
    // 此处 view.status 必为 PUBLISHED（非 PUBLISHED 已在前方守卫返回 null）
    if (options?.publishedOnly) {
      // 独立写操作，不参与读查询事务；increment 为单 SQL，自身具备原子性
      this.postService.incrementViewCount(view.id).catch((error) => {
        this.logger.warn(
          `阅读量自增失败 postId=${view.id}: ${error instanceof Error ? error.message : error}`,
        );
      });
    }

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

    // 置顶始终为最高优先级排序，用户指定排序字段时前置 isPinned DESC
    // 当用户显式按 isPinned 排序时，直接使用用户排序，避免重复字段
    const userSort = params.sortBy
      ? [{ field: params.sortBy, direction: params.sortOrder ?? 'DESC' as const }]
      : [{ field: 'createdAt', direction: 'DESC' as const }];
    const sorts: ReadonlyArray<{ field: string; direction: 'ASC' | 'DESC' }> =
      params.sortBy === 'isPinned' ? userSort : [{ field: 'isPinned', direction: 'DESC' }, ...userSort];

    const result = await this.paginationService.paginateQuery({
      qb,
      params: {
        mode: 'OFFSET',
        page: params.page,
        pageSize: params.pageSize,
        withTotal: true,
        sorts,
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

// ─── 友情链接读 ───

@Injectable()
export class ListBlogFriendLinksUsecase {
  constructor(private readonly friendLinkQueryService: BlogFriendLinkQueryService) {}

  /** 公开接口：仅返回启用的友链 */
  async execute(): Promise<BlogFriendLinkView[]> {
    return this.friendLinkQueryService.listActiveFriendLinks();
  }
}

@Injectable()
export class ListAllBlogFriendLinksUsecase {
  constructor(private readonly friendLinkQueryService: BlogFriendLinkQueryService) {}

  /** 管理端：返回所有友链（含禁用项） */
  async execute(): Promise<BlogFriendLinkView[]> {
    return this.friendLinkQueryService.listAllFriendLinks();
  }
}
