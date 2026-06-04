// src/modules/blog/queries/blog-comment.query.service.ts
// 评论读侧 QueryService：读取、输出规范化，不写、不开事务

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Repository } from 'typeorm';
import { BlogCommentStatus, type BlogCommentView } from '../blog.types';
import { BlogCommentEntity } from '../entities/blog-comment.entity';

@Injectable()
export class BlogCommentQueryService {
  constructor(
    @InjectRepository(BlogCommentEntity)
    private readonly commentRepo: Repository<BlogCommentEntity>,
  ) {}

  async findCommentById(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogCommentView | null> {
    const repo = this.getCommentRepo(transactionContext);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) return null;
    return this.toView(entity);
  }

  /**
   * 查询指定文章下的评论列表（分页由 Usecase 编排 PaginationService）
   * 默认只返回已审核通过的评论
   */
  async listCommentsByPostId(
    postId: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogCommentView[]> {
    const repo = this.getCommentRepo(transactionContext);
    const entities = await repo.find({
      where: { postId, status: BlogCommentStatus.APPROVED },
      order: { createdAt: 'ASC' },
    });
    return entities.map((e) => this.toView(e));
  }

  /**
   * 管理端查询所有评论（含待审核），分页由 Usecase 编排
   */
  async listAllComments(
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogCommentView[]> {
    const repo = this.getCommentRepo(transactionContext);
    const entities = await repo.find({
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.toView(e));
  }

  /**
   * 统计待审核评论数
   */
  async countPendingComments(transactionContext?: PersistenceTransactionContext): Promise<number> {
    const repo = this.getCommentRepo(transactionContext);
    return repo.count({
      where: { status: BlogCommentStatus.PENDING },
    });
  }

  // ─── 内部工具 ───

  private toView(entity: BlogCommentEntity): BlogCommentView {
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
