// src/usecases/blog/blog-read.usecase.ts
// 博客读操作 usecases：封装 QueryService 调用，供 adapter 层通过 usecases 依赖调用
// 分页编排已下沉到 QueryService，usecase 只拿 PaginatedResult<...View>
// 遵守依赖方向：adapters → usecases → modules

import { Injectable } from '@nestjs/common';
import { BlogPostStatus } from '@app-types/models/blog.types';
import {
  BlogPostQueryService,
  type BlogPostPaginationParams,
} from '@modules/blog/queries/blog-post.query.service';
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
  constructor(private readonly postQueryService: BlogPostQueryService) {}

  async execute(params: BlogPostPaginationParams): Promise<PaginatedResult<BlogPostView>> {
    return this.postQueryService.paginatePosts(params);
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
  constructor(private readonly commentQueryService: BlogCommentQueryService) {}

  async execute(params: BlogCommentPaginationParams): Promise<PaginatedResult<BlogCommentView>> {
    return this.commentQueryService.paginateComments(params);
  }
}

@Injectable()
export class ListBlogCommentsByPostUsecase {
  constructor(private readonly commentQueryService: BlogCommentQueryService) {}

  async execute(
    params: BlogCommentByPostPaginationParams,
  ): Promise<PaginatedResult<BlogCommentView>> {
    return this.commentQueryService.paginateCommentsByPost(params);
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
  constructor(private readonly fileQueryService: BlogFileQueryService) {}

  async execute(params: BlogFilePaginationParams): Promise<PaginatedResult<BlogFileView>> {
    return this.fileQueryService.paginateFiles(params);
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
