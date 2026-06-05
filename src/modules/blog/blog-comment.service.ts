// src/modules/blog/blog-comment.service.ts
// 评论聚合根写服务
// 职责：评论的创建、状态更新、批量审核、软删除；不含跨聚合根编排
// View 映射委托 BlogCommentQueryService，避免 toView 重复

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { In, Repository } from 'typeorm';
import sanitizeHtml from 'sanitize-html';
import {
  BlogCommentStatus,
  type BatchUpdateBlogCommentStatusInput,
  type CreateBlogCommentInput,
  type UpdateBlogCommentStatusInput,
  type BlogCommentView,
} from './blog.types';
import { BlogCommentEntity } from './entities/blog-comment.entity';
import {
  BLOG_AVATAR_GENERATOR_TOKEN,
  type AvatarGenerator,
} from './contracts/avatar-generator.contract';
import { BlogCommentQueryService } from './queries/blog-comment.query.service';

/** 评论最大嵌套层级 */
const MAX_NESTING_LEVEL = 5;

@Injectable()
export class BlogCommentService {
  constructor(
    @InjectRepository(BlogCommentEntity)
    private readonly commentRepo: Repository<BlogCommentEntity>,
    @Inject(BLOG_AVATAR_GENERATOR_TOKEN)
    private readonly avatarGenerator: AvatarGenerator,
    private readonly queryService: BlogCommentQueryService,
  ) {}

  async createComment(
    input: CreateBlogCommentInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogCommentView> {
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

    // XSS 清洗：保留安全标签，移除危险脚本和属性
    const sanitizedContent = sanitizeHtml(input.content, {
      allowedTags: [
        'b',
        'i',
        'em',
        'strong',
        'a',
        'p',
        'br',
        'ul',
        'ol',
        'li',
        'blockquote',
        'code',
        'pre',
        'del',
        'ins',
        'sup',
        'sub',
      ],
      allowedAttributes: {
        a: ['href', 'title', 'target', 'rel'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
    });

    const entity = repo.create({
      postId: input.postId,
      parentId: input.parentId ?? null,
      replyToId: input.replyToId ?? null,
      authorName: input.authorName,
      authorEmail: input.authorEmail,
      authorUrl: input.authorUrl ?? null,
      authorAvatar,
      content: sanitizedContent,
      nestingLevel,
    });

    const saved = await repo.save(entity);
    // 刚创建的记录必然存在
    return this.queryService.findCommentById(
      saved.id,
      transactionContext,
    ) as Promise<BlogCommentView>;
  }

  async updateCommentStatus(
    input: UpdateBlogCommentStatusInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogCommentView> {
    const repo = this.getCommentRepo(transactionContext);
    const existing = await repo.findOne({ where: { id: input.id } });
    if (!existing) {
      throw new DomainError(BLOG_ERROR.COMMENT_NOT_FOUND, '评论不存在');
    }
    await repo.update(input.id, { status: input.status });
    // 更新后记录必然存在
    return this.queryService.findCommentById(
      input.id,
      transactionContext,
    ) as Promise<BlogCommentView>;
  }

  /**
   * 批量审核评论状态
   * 单次批量操作完成，不在循环中逐条更新
   * 返回实际更新的行数
   */
  async batchUpdateCommentStatus(
    input: BatchUpdateBlogCommentStatusInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<number> {
    if (input.ids.length === 0) return 0;
    const repo = this.getCommentRepo(transactionContext);
    const result = await repo.update({ id: In(input.ids) }, { status: input.status });
    return result.affected ?? 0;
  }

  async softDeleteComment(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<number> {
    const repo = this.getCommentRepo(transactionContext);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) {
      throw new DomainError(BLOG_ERROR.COMMENT_NOT_FOUND, '评论不存在');
    }
    await repo.softRemove(entity);
    return entity.postId;
  }

  /**
   * 将指定文章下所有评论标记为不可见（SPAM 状态）
   * 用于文章删除时的级联处理，不硬删评论
   */
  async markCommentsHiddenByPostId(
    postId: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const repo = this.getCommentRepo(transactionContext);
    await repo.update({ postId }, { status: BlogCommentStatus.SPAM });
  }

  // ─── 内部工具 ───

  private getCommentRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogCommentEntity> {
    return transactionContext
      ? getTypeOrmEntityManager(transactionContext).getRepository(BlogCommentEntity)
      : this.commentRepo;
  }
}
