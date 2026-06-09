// src/modules/blog/blog-post.service.ts
// 文章聚合根写服务：细粒度写操作，事务上下文由 Usecase 传入
// View 映射委托 BlogPostQueryService，避免 toView 重复
// 聚合内子实体（BlogPostTag）写入通过本服务入口编排，禁止 usecase 绕过聚合根直接调子实体 service

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Repository } from 'typeorm';
import { BlogPostStatus } from '@app-types/models/blog.types';
import {
  type CreateBlogPostInput,
  type UpdateBlogPostInput,
  type BlogPostDetailView,
} from './blog.types';
import { BlogPostEntity } from './entities/blog-post.entity';
import { BlogPostTagService } from './blog-post-tag.service';
import { BlogPostQueryService } from './queries/blog-post.query.service';
import { sanitizeBlogContent } from './sanitize-html.helper';

@Injectable()
export class BlogPostService {
  constructor(
    @InjectRepository(BlogPostEntity)
    private readonly postRepo: Repository<BlogPostEntity>,
    private readonly postTagService: BlogPostTagService,
    private readonly queryService: BlogPostQueryService,
  ) {}

  /**
   * 创建文章并同步标签关联（聚合根入口）
   * usecase 应调用此方法，而非分别调 createPost + postTagService.syncPostTags
   */
  async createPostWithTags(
    input: CreateBlogPostInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogPostDetailView> {
    const view = await this.createPost(input, transactionContext);
    if (!view) {
      throw new DomainError(BLOG_ERROR.POST_CREATE_FAILED, '创建文章后未找到记录');
    }

    if (input.tagIds && input.tagIds.length > 0) {
      await this.postTagService.syncPostTags(view.id, input.tagIds, transactionContext);
    }

    // 标签同步后重新读取完整 view（含 tags），已确认 entity 存在
    return this.queryService.findPostById(
      view.id,
      transactionContext,
    ) as Promise<BlogPostDetailView>;
  }

  /**
   * 更新文章并同步标签关联（聚合根入口）
   * usecase 应调用此方法，而非分别调 updatePost + postTagService.syncPostTags
   */
  async updatePostWithTags(
    id: number,
    input: UpdateBlogPostInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogPostDetailView> {
    // updatePost 内部校验存在性，不存在时抛 DomainError(POST_NOT_FOUND)
    await this.updatePost(id, input, transactionContext);

    if (input.tagIds !== undefined) {
      await this.postTagService.syncPostTags(id, input.tagIds, transactionContext);
    }

    // 标签同步后重新读取完整 view（含 tags），已确认 entity 存在
    return this.queryService.findPostById(id, transactionContext) as Promise<BlogPostDetailView>;
  }

  async createPost(
    input: CreateBlogPostInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogPostDetailView | null> {
    const repo = this.getRepo(transactionContext);
    const entity = repo.create({
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt ?? null,
      content: sanitizeBlogContent(input.content),
      renderedContent:
        input.renderedContent !== undefined ? sanitizeBlogContent(input.renderedContent) : null,
      coverImage: input.coverImage ?? null,
      status: input.status ?? BlogPostStatus.DRAFT,
      categoryId: input.categoryId ?? null,
      isPinned: input.isPinned ?? false,
      publishedAt: input.publishedAt ?? null,
    });
    const saved = await repo.save(entity);
    return this.queryService.findPostById(saved.id, transactionContext);
  }

  async updatePost(
    id: number,
    input: UpdateBlogPostInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogPostDetailView | null> {
    const repo = this.getRepo(transactionContext);

    const entity = await repo.findOne({ where: { id } });
    if (!entity) {
      throw new DomainError(BLOG_ERROR.POST_NOT_FOUND, '文章不存在');
    }

    const patch: Partial<BlogPostEntity> = {};

    if (input.title !== undefined) patch.title = input.title;
    if (input.slug !== undefined) patch.slug = input.slug;
    if (input.excerpt !== undefined) patch.excerpt = input.excerpt;
    if (input.content !== undefined) patch.content = sanitizeBlogContent(input.content);
    if (input.renderedContent !== undefined)
      patch.renderedContent = sanitizeBlogContent(input.renderedContent);
    if (input.coverImage !== undefined) patch.coverImage = input.coverImage;
    if (input.status !== undefined) patch.status = input.status;
    if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
    if (input.isPinned !== undefined) patch.isPinned = input.isPinned;
    if (input.publishedAt !== undefined) patch.publishedAt = input.publishedAt;

    if (Object.keys(patch).length === 0) {
      return this.queryService.findPostById(id, transactionContext);
    }

    await repo.update(id, patch);
    return this.queryService.findPostById(id, transactionContext);
  }

  /**
   * 发布文章（聚合根入口）：校验状态 → 更新为 PUBLISHED + 设置 publishedAt
   * 内部完成存在性校验和状态校验，usecase 无需重复校验
   */
  async publishPost(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogPostDetailView> {
    const repo = this.getRepo(transactionContext);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) {
      throw new DomainError(BLOG_ERROR.POST_NOT_FOUND, '文章不存在');
    }

    if (entity.status === BlogPostStatus.PUBLISHED) {
      throw new DomainError(BLOG_ERROR.POST_ALREADY_PUBLISHED, '文章已发布，无需重复发布');
    }

    if (entity.status === BlogPostStatus.DELETED) {
      throw new DomainError(BLOG_ERROR.POST_DELETED, '已删除的文章不能发布');
    }

    await repo.update(id, {
      status: BlogPostStatus.PUBLISHED,
      publishedAt: new Date(),
    });

    // 已确认 entity 存在，findPostById 不会返回 null
    return this.queryService.findPostById(id, transactionContext) as Promise<BlogPostDetailView>;
  }

  async softDeletePost(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const repo = this.getRepo(transactionContext);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) {
      throw new DomainError(BLOG_ERROR.POST_NOT_FOUND, '文章不存在');
    }
    // 重置互动计数（评论计数、点赞计数归零），须在 softRemove 之前执行
    await repo.update(id, { commentCount: 0, likeCount: 0 });
    // 软删除时同步设置 status=DELETED，确保 BlogPostStatus.DELETED 语义可达
    entity.status = BlogPostStatus.DELETED;
    await repo.softRemove(entity);
  }

  async incrementViewCount(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const repo = this.getRepo(transactionContext);
    await repo.increment({ id }, 'viewCount', 1);
  }

  async incrementCommentCount(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const repo = this.getRepo(transactionContext);
    await repo.increment({ id }, 'commentCount', 1);
  }

  async decrementCommentCount(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const repo = this.getRepo(transactionContext);
    await repo.decrement({ id }, 'commentCount', 1);
  }

  async incrementLikeCount(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const repo = this.getRepo(transactionContext);
    await repo.increment({ id }, 'likeCount', 1);
  }

  async decrementLikeCount(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const repo = this.getRepo(transactionContext);
    await repo.decrement({ id }, 'likeCount', 1);
  }

  /**
   * 断言 slug 唯一性，不唯一时抛 DomainError(SLUG_DUPLICATE)
   * @param slug 待校验的 slug
   * @param excludeId 排除的记录 ID（更新场景排除自身）
   */
  async assertSlugUnique(
    slug: string,
    excludeId?: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const repo = this.getRepo(transactionContext);
    const existing = await repo.findOne({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new DomainError(BLOG_ERROR.POST_SLUG_DUPLICATE, '文章 slug 已存在');
    }
  }

  // ─── 内部工具 ───

  private getRepo(transactionContext?: PersistenceTransactionContext): Repository<BlogPostEntity> {
    return transactionContext
      ? getTypeOrmEntityManager(transactionContext).getRepository(BlogPostEntity)
      : this.postRepo;
  }
}
