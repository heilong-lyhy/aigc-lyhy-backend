// src/usecases/blog/view-blog-post.usecase.ts
// 公开端浏览文章用例：读取文章详情 + 自增阅读量
// 编排：先通过 QueryService 读取文章，若为已发布文章则 fire-and-forget 自增阅读量
// 阅读量自增失败不影响详情返回

import { Injectable, Logger } from '@nestjs/common';
import { BlogPostStatus } from '@app-types/models/blog.types';
import { BlogPostQueryService } from '@modules/blog/queries/blog-post.query.service';
import { BlogPostService } from '@modules/blog/blog-post.service';
import type { BlogPostDetailView } from '@modules/blog/blog.types';

@Injectable()
export class ViewBlogPostUsecase {
  private readonly logger = new Logger(ViewBlogPostUsecase.name);

  constructor(
    private readonly postQueryService: BlogPostQueryService,
    private readonly postService: BlogPostService,
  ) {}

  /**
   * 按 ID 浏览文章（公开端）：读取详情 + 自增阅读量
   * 仅已发布文章触发阅读量自增，非发布或不存在时不触发
   */
  async viewById(id: number): Promise<BlogPostDetailView | null> {
    const view = await this.postQueryService.findPostById(id);
    if (!view) return null;
    if (view.status !== BlogPostStatus.PUBLISHED) return null;

    this.incrementViewCount(view.id);
    return view;
  }

  /**
   * 按 slug 浏览文章（公开端）：读取详情 + 自增阅读量
   * 仅已发布文章触发阅读量自增，非发布或不存在时不触发
   */
  async viewBySlug(slug: string): Promise<BlogPostDetailView | null> {
    const view = await this.postQueryService.findPostBySlug(slug);
    if (!view) return null;
    if (view.status !== BlogPostStatus.PUBLISHED) return null;

    this.incrementViewCount(view.id);
    return view;
  }

  /**
   * 阅读量自增：显式 fire-and-forget
   *
   * 设计依据：docs/plan/blog-feature-completion.md §阅读量自增
   * - 公开端浏览场景下，阅读量是软指标，不应阻塞详情返回
   * - 失败仅 warn 日志，不向上传播，避免读路径因计数器写失败而 5xx
   *
   * 与 usecase.rules.md「写语义由 Usecase 编排」不冲突：
   * - 此处的写仍由 Usecase 触发（非 modules/service 自决）
   * - 失败语义是「可容忍的最终一致」，由 Usecase 显式选择，符合错误映射职责
   */
  private incrementViewCount(postId: number): void {
    this.postService.incrementViewCount(postId).catch((error) => {
      this.logger.warn(
        `阅读量自增失败 postId=${postId}: ${error instanceof Error ? error.message : error}`,
      );
    });
  }
}
