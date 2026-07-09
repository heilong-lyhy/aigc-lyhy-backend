// src/modules/blog/queries/blog-comment.query.service.ts
// 评论读侧 QueryService：读取、输出规范化、分页编排，不写、不开事务

import {
  getTransactionEntityManager,
  type PersistenceTransactionContext,
} from '@app-types/common/transaction.types';
import { BlogCommentStatus } from '@app-types/models/blog.types';
import type { PaginatedResult } from '@core/pagination/pagination.types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationService } from '@modules/common/pagination.service';
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

const COMMENT_SORT_COLUMN_MAP: Record<string, string> = {
  createdAt: 'comment.created_at',
  updatedAt: 'comment.updated_at',
};

const COMMENT_ALLOWED_SORTS = ['createdAt', 'updatedAt'];

@Injectable()
export class BlogCommentQueryService {
  constructor(
    @InjectRepository(BlogCommentEntity)
    private readonly commentRepo: Repository<BlogCommentEntity>,
    private readonly paginationService: PaginationService,
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
   * 评论分页查询（管理端）：在 QueryService 内完成分页编排
   */
  async paginateComments(
    params: BlogCommentPaginationParams,
  ): Promise<PaginatedResult<BlogCommentView>> {
    const qb = this.commentRepo.createQueryBuilder('comment');

    if (params.postId !== undefined) {
      qb.andWhere('comment.post_id = :postId', { postId: params.postId });
    }

    if (params.status !== undefined) {
      qb.andWhere('comment.status = :status', { status: params.status });
    }

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
      allowedSorts: COMMENT_ALLOWED_SORTS,
      defaultSorts: [{ field: 'createdAt', direction: 'DESC' }],
      resolveColumn: (field: string) => COMMENT_SORT_COLUMN_MAP[field] ?? null,
    });

    return {
      ...result,
      items: result.items.map((e) => this.toView(e)),
    };
  }

  /**
   * 指定文章评论分页查询（公开，仅已审核通过的评论）：在 QueryService 内完成分页编排
   */
  async paginateCommentsByPost(
    params: BlogCommentByPostPaginationParams,
  ): Promise<PaginatedResult<BlogCommentView>> {
    const qb = this.commentRepo
      .createQueryBuilder('comment')
      .where('comment.post_id = :postId', { postId: params.postId })
      .andWhere('comment.status = :status', { status: BlogCommentStatus.APPROVED })
      .andWhere('comment.is_hidden = :isHidden', { isHidden: false });

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
      allowedSorts: COMMENT_ALLOWED_SORTS,
      defaultSorts: [{ field: 'createdAt', direction: 'ASC' }],
      resolveColumn: (field: string) => COMMENT_SORT_COLUMN_MAP[field] ?? null,
    });

    return {
      ...result,
      items: result.items.map((e) => this.toView(e)),
    };
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
      isAdminReply: entity.isAdminReply,
      isHidden: entity.isHidden,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private getCommentRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogCommentEntity> {
    return transactionContext
      ? getTransactionEntityManager(transactionContext).getRepository(BlogCommentEntity)
      : this.commentRepo;
  }
}
