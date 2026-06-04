// src/modules/blog/queries/blog-like.query.service.ts
// 点赞读侧 QueryService：读取、输出规范化，不写、不开事务

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Repository } from 'typeorm';
import type { BlogLikeView } from '../blog.types';
import { BlogLikeEntity } from '../entities/blog-like.entity';

@Injectable()
export class BlogLikeQueryService {
  constructor(
    @InjectRepository(BlogLikeEntity)
    private readonly likeRepo: Repository<BlogLikeEntity>,
  ) {}

  /**
   * 判断用户是否已对指定文章点赞
   */
  async hasLiked(
    postId: number,
    userIdentifier: string,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<boolean> {
    const repo = this.getLikeRepo(transactionContext);
    const count = await repo.count({ where: { postId, userIdentifier } });
    return count > 0;
  }

  /**
   * 统计指定文章的点赞数
   */
  async countLikesByPostId(
    postId: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<number> {
    const repo = this.getLikeRepo(transactionContext);
    return repo.count({ where: { postId } });
  }

  /**
   * 查询指定文章的点赞列表（分页由 Usecase 编排）
   */
  async listLikesByPostId(
    postId: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogLikeView[]> {
    const repo = this.getLikeRepo(transactionContext);
    const entities = await repo.find({
      where: { postId },
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.toView(e));
  }

  // ─── 内部工具 ───

  private toView(entity: BlogLikeEntity): BlogLikeView {
    return {
      id: entity.id,
      postId: entity.postId,
      userIdentifier: entity.userIdentifier,
      createdAt: entity.createdAt,
    };
  }

  private getLikeRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogLikeEntity> {
    return transactionContext
      ? getTypeOrmEntityManager(transactionContext).getRepository(BlogLikeEntity)
      : this.likeRepo;
  }
}
