// src/modules/blog/blog-like.service.ts
// 点赞聚合根写服务
// 职责：点赞/取消点赞（幂等 toggle）；不含跨聚合根编排
// likeCount 变更由 usecase 通过 BlogPostService 编排，本服务不跨聚合写入 BlogPostEntity

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { getTypeOrmEntityManager as getTransactionEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogLikeEntity } from './entities/blog-like.entity';

export interface ToggleLikeResult {
  readonly liked: boolean;
}

@Injectable()
export class BlogLikeService {
  constructor(
    @InjectRepository(BlogLikeEntity)
    private readonly likeRepo: Repository<BlogLikeEntity>,
  ) {}

  /**
   * 幂等点赞/取消点赞（仅操作 BlogLike 聚合内实体）
   * 利用 (postId, userIdentifier) 联合唯一约束防重
   * - 未点赞 → 插入，返回 liked=true
   * - 已点赞 → 删除，返回 liked=false
   * likeCount 变更由 usecase 编排 BlogPostService 完成
   */
  async toggleLike(
    postId: number,
    userIdentifier: string,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<ToggleLikeResult> {
    const likeRepo = this.getLikeRepo(transactionContext);

    const existing = await likeRepo.findOne({
      where: { postId, userIdentifier },
    });

    if (existing) {
      await likeRepo.remove(existing);
      return { liked: false };
    }

    const entity = likeRepo.create({ postId, userIdentifier });
    await likeRepo.save(entity);
    return { liked: true };
  }

  /**
   * 删除指定文章的所有点赞（用于文章删除时清理）
   */
  async deleteLikesByPostId(
    postId: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const likeRepo = this.getLikeRepo(transactionContext);
    await likeRepo.delete({ postId });
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
