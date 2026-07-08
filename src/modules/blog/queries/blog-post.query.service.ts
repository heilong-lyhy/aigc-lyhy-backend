// src/modules/blog/queries/blog-post.query.service.ts
// 文章读侧 QueryService：读取、输出规范化、分页编排，不写、不开事务
// 分页编排下沉到 QueryService，usecase 只拿 PaginatedResult<BlogPostView>

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { BlogPostStatus } from '@app-types/models/blog.types';
import { BLOG_ERROR } from '@core/common/errors';
import { DomainError } from '@core/common/errors/domain-error';
import type { PaginatedResult } from '@core/pagination/pagination.types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationService } from '@modules/common/pagination.service';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { In, Repository } from 'typeorm';
import type { BlogPostDetailView, BlogPostView, BlogTagView } from '../blog.types';
import { BlogPostEntity } from '../entities/blog-post.entity';
import { BlogPostTagEntity } from '../entities/blog-post-tag.entity';
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

const POST_SORT_COLUMN_MAP: Record<string, string> = {
  isPinned: 'post.is_pinned',
  createdAt: 'post.created_at',
  publishedAt: 'post.published_at',
  viewCount: 'post.view_count',
  likeCount: 'post.like_count',
  title: 'post.title',
  deletedAt: 'post.deleted_at',
};

const POST_ALLOWED_SORTS = [
  'isPinned',
  'createdAt',
  'publishedAt',
  'viewCount',
  'likeCount',
  'title',
];
const POST_DEFAULT_SORTS = [
  { field: 'isPinned', direction: 'DESC' as const },
  { field: 'createdAt', direction: 'DESC' as const },
];

const DELETED_POST_ALLOWED_SORTS = ['deletedAt', 'createdAt', 'title'];
const DELETED_POST_DEFAULT_SORTS = [{ field: 'deletedAt', direction: 'DESC' as const }];

@Injectable()
export class BlogPostQueryService {
  constructor(
    @InjectRepository(BlogPostEntity)
    private readonly postRepo: Repository<BlogPostEntity>,
    @InjectRepository(BlogPostTagEntity)
    private readonly postTagRepo: Repository<BlogPostTagEntity>,
    private readonly categoryQueryService: BlogCategoryQueryService,
    private readonly tagQueryService: BlogTagQueryService,
    private readonly paginationService: PaginationService,
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
    if (!entity) {
      throw new DomainError(BLOG_ERROR.POST_NOT_FOUND, `文章 ID ${id} 不存在`);
    }
    return entity.likeCount;
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
    return this.mapEntitiesToViews(entities, ids, transactionContext);
  }

  /**
   * 按 ID 批量查询已删除文章视图（含软删除记录，供回收站列表使用）
   * 使用 withDeleted() 确保能查到 deletedAt 不为空的记录
   */
  async findDeletedPostsByIdsForViewMapping(
    ids: number[],
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogPostView[]> {
    if (ids.length === 0) return [];

    const repo = this.getPostRepo(transactionContext);
    const entities = await repo
      .createQueryBuilder('post')
      .withDeleted()
      .where('post.id IN (:...ids)', { ids })
      .getMany();
    return this.mapEntitiesToViews(entities, ids, transactionContext);
  }

  /**
   * 将实体列表映射为 BlogPostView 列表（共享 mapper，避免重复）
   * 加载关联 category 名称，按 ids 顺序返回
   */
  private async mapEntitiesToViews(
    entities: BlogPostEntity[],
    ids: number[],
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogPostView[]> {
    if (entities.length === 0) return [];

    const categoryIds = [
      ...new Set(entities.map((e) => e.categoryId).filter((id): id is number => id !== null)),
    ];
    const categoryMap = await this.categoryQueryService.findCategoryNamesByIds(
      categoryIds,
      transactionContext,
    );

    // 批量查询文章-标签关联
    const postIds = entities.map((e) => e.id);
    const postTags = await this.postTagRepo.find({
      where: { postId: In(postIds) },
    });
    const tagIdsMap = new Map<number, number[]>();
    for (const pt of postTags) {
      const arr = tagIdsMap.get(pt.postId) ?? [];
      arr.push(pt.tagId);
      tagIdsMap.set(pt.postId, arr);
    }

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
          tagIds: tagIdsMap.get(entity.id) ?? [],
          viewCount: entity.viewCount,
          likeCount: entity.likeCount,
          commentCount: entity.commentCount,
          isPinned: entity.isPinned,
          publishedAt: entity.publishedAt,
          deletedAt: entity.deletedAt,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
        },
      ]),
    );

    return ids.map((id) => viewMap.get(id)).filter((v): v is BlogPostView => v !== undefined);
  }

  /**
   * 文章分页查询：在 QueryService 内完成分页编排，返回 PaginatedResult<BlogPostView>
   * 已应用软删除过滤和可选的状态/分类/标题筛选
   */
  async paginatePosts(params: BlogPostPaginationParams): Promise<PaginatedResult<BlogPostView>> {
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

    // 置顶始终为最高优先级排序，用户指定排序字段时前置 isPinned DESC
    const userSort = params.sortBy
      ? [{ field: params.sortBy, direction: params.sortOrder ?? ('DESC' as const) }]
      : [{ field: 'createdAt', direction: 'DESC' as const }];
    const sorts: ReadonlyArray<{ field: string; direction: 'ASC' | 'DESC' }> =
      params.sortBy === 'isPinned'
        ? userSort
        : [{ field: 'isPinned', direction: 'DESC' }, ...userSort];

    const result = await this.paginationService.paginateQuery({
      qb,
      params: {
        mode: 'OFFSET',
        page: params.page,
        pageSize: params.pageSize,
        withTotal: true,
        sorts,
      },
      allowedSorts: POST_ALLOWED_SORTS,
      defaultSorts: POST_DEFAULT_SORTS,
      resolveColumn: (field: string) => POST_SORT_COLUMN_MAP[field] ?? null,
    });

    const ids = result.items.map((e) => e.id);
    const views = ids.length > 0 ? await this.findPostsByIdsForViewMapping(ids) : [];

    return {
      ...result,
      items: views,
    };
  }

  /**
   * 已删除文章分页查询（管理端回收站）：在 QueryService 内完成分页编排
   */
  async paginateDeletedPosts(
    params: BlogPostPaginationParams,
  ): Promise<PaginatedResult<BlogPostView>> {
    const qb = this.postRepo
      .createQueryBuilder('post')
      .withDeleted()
      .where('post.deleted_at IS NOT NULL');

    if (params.categoryId !== undefined) {
      qb.andWhere('post.category_id = :categoryId', { categoryId: params.categoryId });
    }
    if (params.title !== undefined) {
      qb.andWhere('post.title LIKE :title', { title: `%${params.title}%` });
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
          : [{ field: 'deletedAt', direction: 'DESC' }],
      },
      allowedSorts: DELETED_POST_ALLOWED_SORTS,
      defaultSorts: DELETED_POST_DEFAULT_SORTS,
      resolveColumn: (field: string) => POST_SORT_COLUMN_MAP[field] ?? null,
    });

    const ids = result.items.map((e) => e.id);
    const views = ids.length > 0 ? await this.findDeletedPostsByIdsForViewMapping(ids) : [];

    return {
      ...result,
      items: views,
    };
  }

  /**
   * 查找下一篇已发布文章（publishedAt 严格大于当前文章，或 publishedAt 相同且 id 严格大于）
   * 按 publishedAt ASC, id ASC 排序取第一条
   */
  async findNextPost(
    publishedAt: Date,
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<Pick<BlogPostView, 'id' | 'title' | 'slug'> | null> {
    const repo = this.getPostRepo(transactionContext);
    const entity = await repo
      .createQueryBuilder('post')
      .select(['post.id', 'post.title', 'post.slug'])
      .where('post.deleted_at IS NULL')
      .andWhere('post.status = :status', { status: BlogPostStatus.PUBLISHED })
      .andWhere(
        '(post.published_at > :publishedAt OR (post.published_at = :publishedAt AND post.id > :id))',
        { publishedAt, id },
      )
      .orderBy('post.published_at', 'ASC')
      .addOrderBy('post.id', 'ASC')
      .limit(1)
      .getOne();

    if (!entity) return null;
    return { id: entity.id, title: entity.title, slug: entity.slug };
  }

  /**
   * 查找上一篇已发布文章（publishedAt 严格小于当前文章，或 publishedAt 相同且 id 严格小于）
   * 按 publishedAt DESC, id DESC 排序取第一条
   */
  async findPrevPost(
    publishedAt: Date,
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<Pick<BlogPostView, 'id' | 'title' | 'slug'> | null> {
    const repo = this.getPostRepo(transactionContext);
    const entity = await repo
      .createQueryBuilder('post')
      .select(['post.id', 'post.title', 'post.slug'])
      .where('post.deleted_at IS NULL')
      .andWhere('post.status = :status', { status: BlogPostStatus.PUBLISHED })
      .andWhere(
        '(post.published_at < :publishedAt OR (post.published_at = :publishedAt AND post.id < :id))',
        { publishedAt, id },
      )
      .orderBy('post.published_at', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .limit(1)
      .getOne();

    if (!entity) return null;
    return { id: entity.id, title: entity.title, slug: entity.slug };
  }

  // ─── 视图映射 ───

  private async buildDetailView(
    entity: BlogPostEntity,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogPostDetailView> {
    const [categoryMap, tags, prevPost, nextPost] = await Promise.all([
      entity.categoryId
        ? this.categoryQueryService.findCategoryNamesByIds([entity.categoryId], transactionContext)
        : Promise.resolve({} as Record<number, string>),
      this.getPostTags(entity.id, transactionContext),
      entity.publishedAt
        ? this.findPrevPost(entity.publishedAt, entity.id, transactionContext)
        : Promise.resolve(null),
      entity.publishedAt
        ? this.findNextPost(entity.publishedAt, entity.id, transactionContext)
        : Promise.resolve(null),
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
      tagIds: tags.map((t) => t.id),
      tags,
      viewCount: entity.viewCount,
      likeCount: entity.likeCount,
      commentCount: entity.commentCount,
      isPinned: entity.isPinned,
      publishedAt: entity.publishedAt,
      deletedAt: entity.deletedAt,
      prevPost,
      nextPost,
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

  private getPostRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogPostEntity> {
    return transactionContext
      ? getTypeOrmEntityManager(transactionContext).getRepository(BlogPostEntity)
      : this.postRepo;
  }
}
