// src/modules/blog/queries/blog-like.query.service.ts
// 点赞读侧 QueryService：读取、输出规范化，不写、不开事务

import {
  getTransactionEntityManager,
  type PersistenceTransactionContext,
} from '@app-types/common/transaction.types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  // ─── 内部工具 ───

  private getLikeRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogLikeEntity> {
    return transactionContext
      ? getTransactionEntityManager(transactionContext).getRepository(BlogLikeEntity)
      : this.likeRepo;
  }
}
