// src/modules/blog/queries/blog-dashboard.query.service.ts
// 仪表盘统计 QueryService：纯读操作，聚合多表统计，不写、不开事务

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Repository } from 'typeorm';
import { BlogPostStatus, BlogCommentStatus, type BlogDashboardView } from '../blog.types';
import { BlogCategoryEntity } from '../entities/blog-category.entity';
import { BlogCommentEntity } from '../entities/blog-comment.entity';
import { BlogLikeEntity } from '../entities/blog-like.entity';
import { BlogPostEntity } from '../entities/blog-post.entity';
import { BlogTagEntity } from '../entities/blog-tag.entity';

@Injectable()
export class BlogDashboardQueryService {
  constructor(
    @InjectRepository(BlogPostEntity)
    private readonly postRepo: Repository<BlogPostEntity>,
    @InjectRepository(BlogCategoryEntity)
    private readonly categoryRepo: Repository<BlogCategoryEntity>,
    @InjectRepository(BlogTagEntity)
    private readonly tagRepo: Repository<BlogTagEntity>,
    @InjectRepository(BlogCommentEntity)
    private readonly commentRepo: Repository<BlogCommentEntity>,
    @InjectRepository(BlogLikeEntity)
    private readonly likeRepo: Repository<BlogLikeEntity>,
  ) {}

  /**
   * 获取仪表盘统计数据
   * - 各统计独立查询，避免复杂 JOIN；数据量小，性能可接受
   * - 可直接返回 DTO，无需映射 Entity
   * @param transactionContext 可选事务上下文，用于在同一事务内读取数据；
   *   仪表盘查询本身不开启事务，此参数仅为保持与 modules 层方法签名一致
   */
  async getDashboardStats(
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogDashboardView> {
    const postRepo = this.resolveRepo(transactionContext, this.postRepo, BlogPostEntity);
    const categoryRepo = this.resolveRepo(
      transactionContext,
      this.categoryRepo,
      BlogCategoryEntity,
    );
    const tagRepo = this.resolveRepo(transactionContext, this.tagRepo, BlogTagEntity);
    const commentRepo = this.resolveRepo(transactionContext, this.commentRepo, BlogCommentEntity);
    const likeRepo = this.resolveRepo(transactionContext, this.likeRepo, BlogLikeEntity);

    const [
      totalPosts,
      publishedPosts,
      draftPosts,
      totalCategories,
      totalTags,
      totalComments,
      pendingComments,
      totalLikes,
      totalViews,
    ] = await Promise.all([
      postRepo.count(),
      postRepo.count({ where: { status: BlogPostStatus.PUBLISHED } }),
      postRepo.count({ where: { status: BlogPostStatus.DRAFT } }),
      categoryRepo.count(),
      tagRepo.count(),
      commentRepo.count(),
      commentRepo.count({ where: { status: BlogCommentStatus.PENDING } }),
      likeRepo.count(),
      this.sumPostViewCount(postRepo),
    ]);

    return {
      totalPosts,
      publishedPosts,
      draftPosts,
      totalCategories,
      totalTags,
      totalComments,
      pendingComments,
      totalLikes,
      totalViews,
    };
  }

  /**
   * 聚合所有文章的 viewCount 总和
   * - 无文章时返回 0
   */
  private async sumPostViewCount(postRepo: Repository<BlogPostEntity>): Promise<number> {
    const result = await postRepo
      .createQueryBuilder('post')
      .select('COALESCE(SUM(post.view_count), 0)', 'totalViews')
      .where('post.deleted_at IS NULL')
      .getRawOne<{ totalViews: string }>();

    return Number(result?.totalViews ?? 0);
  }

  private resolveRepo<T extends object>(
    transactionContext: PersistenceTransactionContext | undefined,
    defaultRepo: Repository<T>,
    entityClass: new (...args: unknown[]) => T,
  ): Repository<T> {
    return transactionContext
      ? getTypeOrmEntityManager(transactionContext).getRepository(entityClass)
      : defaultRepo;
  }
}
