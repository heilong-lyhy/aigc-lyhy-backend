// src/modules/blog/queries/blog-post.query.service.ts
// 文章读侧 QueryService：读取、输出规范化，不写、不开事务
// 分页列表查询由 Usecase 调用 PaginationService 编排，QueryService 只提供基础读取与视图映射

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { BlogPostStatus } from '@app-types/models/blog.types';
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { In, Repository } from 'typeorm';
import type { BlogPostDetailView, BlogPostView, BlogTagView } from '../blog.types';
import { BlogPostEntity } from '../entities/blog-post.entity';
import { BlogCategoryQueryService } from './blog-category.query.service';
import { BlogTagQueryService } from './blog-tag.query.service';

export interface BlogPostPaginationParams {
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy?: string;
  readonly sortOrder?: 'ASC' | 'DESC';
  readonly status?: BlogPostStatus;
  readonly categoryId?: number;
  readonly title?: string;
  readonly tagId?: number;
}

@Injectable()
export class BlogPostQueryService {
  constructor(
    @InjectRepository(BlogPostEntity)
    private readonly postRepo: Repository<BlogPostEntity>,
    @Inject(forwardRef(() => BlogCategoryQueryService))
    private readonly categoryQueryService: BlogCategoryQueryService,
    private readonly tagQueryService: BlogTagQueryService,
  ) {}

  async findPostById(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogPostDetailView | null> {
    const repo = this.getPostRepo(transactionContext);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) return null;
    return this.buildDetailView(entity, transactionContext);
  }

  /**
   * 轻量存在性检查：仅判断文章是否存在，不触发 buildDetailView 的关联查询
   * 供同域 usecase 做存在性校验使用，避免 N+1
   */
  async postExists(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<boolean> {
    const repo = this.getPostRepo(transactionContext);
    const count = await repo.count({ where: { id } });
    return count > 0;
  }

  /**
   * 轻量级写后读：仅获取文章当前点赞数，不触发 buildDetailView 的关联查询
   * 供同域 usecase 写后读使用，避免 N+1
   */
  async getLikeCount(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<number> {
    const repo = this.getPostRepo(transactionContext);
    const entity = await repo.findOne({ where: { id }, select: { likeCount: true } });
    return entity?.likeCount ?? 0;
  }

  async findPostBySlug(
    slug: string,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogPostDetailView | null> {
    const repo = this.getPostRepo(transactionContext);
    const entity = await repo.findOne({ where: { slug } });
    if (!entity) return null;
    return this.buildDetailView(entity, transactionContext);
  }

  /**
   * 按 ID 批量查询文章视图（供 Usecase 分页后调用，避免 N+1）
   * 一次性加载所有关联的 category，再在内存中映射
   * 返回顺序与输入 ids 顺序一致
   */
  async findPostsByIdsForViewMapping(
    ids: number[],
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogPostView[]> {
    if (ids.length === 0) return [];

    const repo = this.getPostRepo(transactionContext);
    const entities = await repo.findBy({ id: In(ids) });
    if (entities.length === 0) return [];

    const categoryIds = [
      ...new Set(entities.map((e) => e.categoryId).filter((id): id is number => id !== null)),
    ];
    const categoryMap = await this.categoryQueryService.findCategoryNamesByIds(
      categoryIds,
      transactionContext,
    );

    const viewMap = new Map<number, BlogPostView>(
      entities.map((entity) => [
        entity.id,
        {
          id: entity.id,
          title: entity.title,
          slug: entity.slug,
          excerpt: entity.excerpt,
          coverImage: entity.coverImage,
          status: entity.status,
          categoryId: entity.categoryId,
          categoryName: entity.categoryId ? (categoryMap[entity.categoryId] ?? null) : null,
          viewCount: entity.viewCount,
          likeCount: entity.likeCount,
          commentCount: entity.commentCount,
          isPinned: entity.isPinned,
          publishedAt: entity.publishedAt,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
        },
      ]),
    );

    return ids.map((id) => viewMap.get(id)).filter((v): v is BlogPostView => v !== undefined);
  }

  /**
   * 创建文章分页查询 QueryBuilder（供 Usecase 调用 PaginationService 编排分页）
   * 已应用软删除过滤和可选的状态/分类/标题筛选
   */
  createPostQueryBuilder(params: BlogPostPaginationParams) {
    const qb = this.postRepo.createQueryBuilder('post').where('post.deleted_at IS NULL');

    if (params.status !== undefined) {
      qb.andWhere('post.status = :status', { status: params.status });
    }
    if (params.categoryId !== undefined) {
      qb.andWhere('post.category_id = :categoryId', { categoryId: params.categoryId });
    }
    if (params.title !== undefined) {
      qb.andWhere('post.title LIKE :title', { title: `%${params.title}%` });
    }
    if (params.tagId !== undefined) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM blog_post_tag pt WHERE pt.post_id = post.id AND pt.tag_id = :tagId)',
        { tagId: params.tagId },
      );
    }

    return qb;
  }

  // ─── 视图映射 ───

  private async buildDetailView(
    entity: BlogPostEntity,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogPostDetailView> {
    const [categoryMap, tags] = await Promise.all([
      entity.categoryId
        ? this.categoryQueryService.findCategoryNamesByIds([entity.categoryId], transactionContext)
        : Promise.resolve({} as Record<number, string>),
      this.getPostTags(entity.id, transactionContext),
    ]);

    const categoryName = entity.categoryId ? (categoryMap[entity.categoryId] ?? null) : null;

    return {
      id: entity.id,
      title: entity.title,
      slug: entity.slug,
      excerpt: entity.excerpt,
      content: entity.content,
      renderedContent: entity.renderedContent,
      coverImage: entity.coverImage,
      status: entity.status,
      categoryId: entity.categoryId,
      categoryName,
      tags,
      viewCount: entity.viewCount,
      likeCount: entity.likeCount,
      commentCount: entity.commentCount,
      isPinned: entity.isPinned,
      publishedAt: entity.publishedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  // ─── 内部工具 ───

  private async getPostTags(
    postId: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogTagView[]> {
    return this.tagQueryService.findTagsByPostId(postId, transactionContext);
  }

  /**
   * 批量统计各分类下的文章数（供同域 QueryService 委托调用，避免跨聚合直接读取 Entity）
   */
  async countPostsByCategoryIds(
    categoryIds: number[],
    transactionContext?: PersistenceTransactionContext,
  ): Promise<Record<number, number>> {
    if (categoryIds.length === 0) return {};
    const repo = this.getPostRepo(transactionContext);
    const result = await repo
      .createQueryBuilder('post')
      .select('post.category_id', 'categoryId')
      .addSelect('COUNT(*)', 'count')
      .where('post.category_id IN (:...ids)', { ids: categoryIds })
      .andWhere('post.deleted_at IS NULL')
      .groupBy('post.category_id')
      .getRawMany<{ categoryId: number; count: string }>();

    const map: Record<number, number> = {};
    for (const row of result) {
      map[row.categoryId] = Number(row.count);
    }
    return map;
  }

  private getPostRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogPostEntity> {
    return transactionContext
      ? getTypeOrmEntityManager(transactionContext).getRepository(BlogPostEntity)
      : this.postRepo;
  }
}
