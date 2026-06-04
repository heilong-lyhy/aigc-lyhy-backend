// src/modules/blog/blog-post.service.ts
// 文章聚合根写服务：细粒度写操作，事务上下文由 Usecase 传入

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Repository } from 'typeorm';
import {
  BlogPostStatus,
  type CreateBlogPostInput,
  type UpdateBlogPostInput,
  type BlogPostWriteResult,
} from './blog.types';
import { BlogPostEntity } from './entities/blog-post.entity';

@Injectable()
export class BlogPostService {
  constructor(
    @InjectRepository(BlogPostEntity)
    private readonly postRepo: Repository<BlogPostEntity>,
  ) {}

  async createPost(
    input: CreateBlogPostInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogPostWriteResult> {
    const repo = this.getRepo(transactionContext);
    const entity = repo.create({
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt ?? null,
      content: input.content,
      renderedContent: input.renderedContent ?? null,
      coverImage: input.coverImage ?? null,
      status: input.status ?? BlogPostStatus.DRAFT,
      categoryId: input.categoryId ?? null,
      isPinned: input.isPinned ?? false,
      publishedAt: input.publishedAt ?? null,
    });
    const saved = await repo.save(entity);
    return this.toView(saved);
  }

  async updatePost(
    id: number,
    input: UpdateBlogPostInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogPostWriteResult> {
    const repo = this.getRepo(transactionContext);

    const entity = await repo.findOne({ where: { id } });
    if (!entity) {
      throw new DomainError(BLOG_ERROR.POST_NOT_FOUND, '文章不存在');
    }

    const patch: Partial<BlogPostEntity> = {};

    if (input.title !== undefined) patch.title = input.title;
    if (input.slug !== undefined) patch.slug = input.slug;
    if (input.excerpt !== undefined) patch.excerpt = input.excerpt;
    if (input.content !== undefined) patch.content = input.content;
    if (input.renderedContent !== undefined) patch.renderedContent = input.renderedContent;
    if (input.coverImage !== undefined) patch.coverImage = input.coverImage;
    if (input.status !== undefined) patch.status = input.status;
    if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
    if (input.isPinned !== undefined) patch.isPinned = input.isPinned;
    if (input.publishedAt !== undefined) patch.publishedAt = input.publishedAt;

    if (Object.keys(patch).length === 0) {
      return this.toView(entity);
    }

    await repo.update(id, patch);
    const updated = await repo.findOne({ where: { id } });
    if (!updated) {
      throw new DomainError(BLOG_ERROR.POST_NOT_FOUND, '文章不存在');
    }
    return this.toView(updated);
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

  // ─── 内部工具 ───

  private toView(entity: BlogPostEntity): BlogPostWriteResult {
    return {
      id: entity.id,
      title: entity.title,
      slug: entity.slug,
      excerpt: entity.excerpt,
      coverImage: entity.coverImage,
      status: entity.status,
      categoryId: entity.categoryId,
      viewCount: entity.viewCount,
      likeCount: entity.likeCount,
      commentCount: entity.commentCount,
      isPinned: entity.isPinned,
      publishedAt: entity.publishedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private getRepo(transactionContext?: PersistenceTransactionContext): Repository<BlogPostEntity> {
    return transactionContext
      ? getTypeOrmEntityManager(transactionContext).getRepository(BlogPostEntity)
      : this.postRepo;
  }
}
