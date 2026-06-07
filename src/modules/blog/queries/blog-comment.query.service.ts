// src/modules/blog/queries/blog-comment.query.service.ts
// 评论读侧 QueryService：读取、输出规范化，不写、不开事务

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { BlogCommentStatus } from '@app-types/models/blog.types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Repository } from 'typeorm';
import type { BlogCommentView } from '../blog.types';
import { BlogCommentEntity } from '../entities/blog-comment.entity';

export interface BlogCommentPaginationParams {
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy?: string;
  readonly sortOrder?: 'ASC' | 'DESC';
  readonly postId?: number;
  readonly status?: BlogCommentStatus;
}

export interface BlogCommentByPostPaginationParams {
  readonly postId: number;
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy?: string;
  readonly sortOrder?: 'ASC' | 'DESC';
}

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

  /**
   * 创建评论分页查询 QueryBuilder（管理端，供 Usecase 编排分页）
   */
  createCommentQueryBuilder(params: BlogCommentPaginationParams) {
    const qb = this.commentRepo.createQueryBuilder('comment');

    if (params.postId !== undefined) {
      qb.andWhere('comment.post_id = :postId', { postId: params.postId });
    }

    if (params.status !== undefined) {
      qb.andWhere('comment.status = :status', { status: params.status });
    }

    return qb;
  }

  /**
   * 创建指定文章评论分页查询 QueryBuilder（公开，仅已审核通过的评论，供 Usecase 编排分页）
   */
  createCommentByPostQueryBuilder(params: BlogCommentByPostPaginationParams) {
    return this.commentRepo
      .createQueryBuilder('comment')
      .where('comment.post_id = :postId', { postId: params.postId })
      .andWhere('comment.status = :status', { status: BlogCommentStatus.APPROVED });
  }

  /**
   * 将 Entity 映射为 View（供 Usecase 分页后调用）
   */
  toView(entity: BlogCommentEntity): BlogCommentView {
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
