// src/modules/blog/blog-like.service.ts
// 点赞聚合根写服务
// 职责：点赞/取消点赞（幂等 toggle）；不含跨聚合根编排
//
// ARCHITECTURE-DEBT: toggleLike 内部直接 increment/decrement BlogPostEntity.likeCount
// 属于跨聚合写入，违反 aggregate.rules.md "跨聚合写入由 usecase 编排"。
// 修复方案：待 blog usecase 层交付时，将 likeCount 变更提升到 usecase 编排，
// BlogLikeService 只负责 BlogLike 聚合内的写入，BlogPostEntity 的 likeCount 变更
// 由 usecase 调用 BlogPostService 完成。
// 规范引用: docs/common/aggregate.rules.md "跨聚合写入由 usecase 编排"

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Repository } from 'typeorm';
import { BlogLikeEntity } from './entities/blog-like.entity';
import { BlogPostEntity } from './entities/blog-post.entity';

export interface ToggleLikeResult {
  readonly liked: boolean;
  readonly likeCount: number;
}

@Injectable()
export class BlogLikeService {
  constructor(
    @InjectRepository(BlogLikeEntity)
    private readonly likeRepo: Repository<BlogLikeEntity>,
    @InjectRepository(BlogPostEntity)
    private readonly postRepo: Repository<BlogPostEntity>,
  ) {}

  /**
   * 幂等点赞/取消点赞
   * 利用 (postId, userIdentifier) 联合唯一约束防重
   * - 未点赞 → 插入 + likeCount +1
   * - 已点赞 → 删除 + likeCount -1
   */
  async toggleLike(
    postId: number,
    userIdentifier: string,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<ToggleLikeResult> {
    const likeRepo = this.getLikeRepo(transactionContext);
    const postRepo = this.getPostRepo(transactionContext);

    const post = await postRepo.findOne({ where: { id: postId } });
    if (!post) {
      throw new DomainError(BLOG_ERROR.POST_NOT_FOUND, '文章不存在');
    }

    const existing = await likeRepo.findOne({
      where: { postId, userIdentifier },
    });

    let liked: boolean;
    if (existing) {
      await likeRepo.remove(existing);
      await postRepo.decrement({ id: postId }, 'likeCount', 1);
      liked = false;
    } else {
      const entity = likeRepo.create({ postId, userIdentifier });
      await likeRepo.save(entity);
      await postRepo.increment({ id: postId }, 'likeCount', 1);
      liked = true;
    }

    const updated = await postRepo.findOne({ where: { id: postId } });
    return {
      liked,
      likeCount: updated?.likeCount ?? 0,
    };
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
      ? getTypeOrmEntityManager(transactionContext).getRepository(BlogLikeEntity)
      : this.likeRepo;
  }

  private getPostRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogPostEntity> {
    return transactionContext
      ? getTypeOrmEntityManager(transactionContext).getRepository(BlogPostEntity)
      : this.postRepo;
  }
}
