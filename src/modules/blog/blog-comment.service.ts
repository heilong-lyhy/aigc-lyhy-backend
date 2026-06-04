// src/modules/blog/blog-comment.service.ts
// 评论聚合根写服务
// 职责：评论的创建、状态更新、批量审核、软删除；不含跨聚合根编排

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { In, Repository } from 'typeorm';
import type {
  BatchUpdateBlogCommentStatusInput,
  BlogCommentWriteResult,
  CreateBlogCommentInput,
  UpdateBlogCommentStatusInput,
} from './blog.types';
import { BlogCommentEntity } from './entities/blog-comment.entity';
import {
  BLOG_AVATAR_GENERATOR_TOKEN,
  type AvatarGenerator,
} from './contracts/avatar-generator.contract';

/** 评论最大嵌套层级 */
const MAX_NESTING_LEVEL = 5;

@Injectable()
export class BlogCommentService {
  constructor(
    @InjectRepository(BlogCommentEntity)
    private readonly commentRepo: Repository<BlogCommentEntity>,
    @Inject(BLOG_AVATAR_GENERATOR_TOKEN)
    private readonly avatarGenerator: AvatarGenerator,
  ) {}

  async createComment(
    input: CreateBlogCommentInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogCommentWriteResult> {
    const repo = this.getCommentRepo(transactionContext);

    let nestingLevel = 0;
    if (input.parentId) {
      const parent = await repo.findOne({ where: { id: input.parentId } });
      if (!parent) {
        throw new DomainError(BLOG_ERROR.COMMENT_NOT_FOUND, '父评论不存在');
      }
      nestingLevel = parent.nestingLevel + 1;
      if (nestingLevel > MAX_NESTING_LEVEL) {
        throw new DomainError(BLOG_ERROR.COMMENT_NESTING_EXCEEDED, '评论嵌套层级超过上限');
      }
    }

    // 头像生成：通过 AvatarGenerator boundary contract 实现
    const authorAvatar = await this.avatarGenerator.generateAvatar(input.authorEmail);

    const entity = repo.create({
      postId: input.postId,
      parentId: input.parentId ?? null,
      replyToId: input.replyToId ?? null,
      authorName: input.authorName,
      authorEmail: input.authorEmail,
      authorUrl: input.authorUrl ?? null,
      authorAvatar,
      content: input.content,
      nestingLevel,
    });

    const saved = await repo.save(entity);
    return this.toView(saved);
  }

  async updateCommentStatus(
    input: UpdateBlogCommentStatusInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogCommentWriteResult> {
    const repo = this.getCommentRepo(transactionContext);
    const entity = await repo.findOne({ where: { id: input.id } });
    if (!entity) {
      throw new DomainError(BLOG_ERROR.COMMENT_NOT_FOUND, '评论不存在');
    }
    entity.status = input.status;
    const saved = await repo.save(entity);
    return this.toView(saved);
  }

  /**
   * 批量审核评论状态
   * 单次批量操作完成，不在循环中逐条更新
   */
  async batchUpdateCommentStatus(
    input: BatchUpdateBlogCommentStatusInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    if (input.ids.length === 0) return;
    const repo = this.getCommentRepo(transactionContext);
    await repo.update({ id: In(input.ids) }, { status: input.status });
  }

  async softDeleteComment(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const repo = this.getCommentRepo(transactionContext);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) {
      throw new DomainError(BLOG_ERROR.COMMENT_NOT_FOUND, '评论不存在');
    }
    await repo.softRemove(entity);
  }

  // ─── 内部工具 ───

  private toView(entity: BlogCommentEntity): BlogCommentWriteResult {
    return {
      id: entity.id,
      postId: entity.postId,
      parentId: entity.parentId,
      replyToId: entity.replyToId,
      authorName: entity.authorName,
      authorAvatar: entity.authorAvatar,
      content: entity.content,
      status: entity.status,
      nestingLevel: entity.nestingLevel,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private getCommentRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogCommentEntity> {
    return transactionContext
      ? getTypeOrmEntityManager(transactionContext).getRepository(BlogCommentEntity)
      : this.commentRepo;
  }
}
