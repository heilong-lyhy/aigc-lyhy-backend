// src/modules/blog/queries/blog-category.query.service.ts
// 分类读侧 QueryService：读取、输出规范化，不写、不开事务
// 依赖方向单向：BlogPostQueryService → BlogCategoryQueryService，不形成环

import {
  getTransactionEntityManager,
  type PersistenceTransactionContext,
} from '@app-types/common/transaction.types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { BlogCategoryTreeView, BlogCategoryView } from '../blog.types';
import { BlogCategoryEntity } from '../entities/blog-category.entity';
import { BlogPostEntity } from '../entities/blog-post.entity';

@Injectable()
export class BlogCategoryQueryService {
  constructor(
    @InjectRepository(BlogCategoryEntity)
    private readonly categoryRepo: Repository<BlogCategoryEntity>,
    @InjectRepository(BlogPostEntity)
    private readonly postRepo: Repository<BlogPostEntity>,
  ) {}

  async findCategoryById(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogCategoryView | null> {
    const repo = this.getCategoryRepo(transactionContext);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) return null;
    const postCounts = await this.countPostsByCategoryIds([id], transactionContext);
    return this.toView(entity, postCounts[id] ?? 0);
  }

  async listAllCategories(
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogCategoryView[]> {
    const repo = this.getCategoryRepo(transactionContext);
    const entities = await repo.find({
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    const postCounts = await this.countPostsByCategoryIds(
      entities.map((e) => e.id),
      transactionContext,
    );
    return entities.map((e) => this.toView(e, postCounts[e.id] ?? 0));
  }

  /**
   * 批量查询分类名称（供同域 QueryService 委托调用，避免跨聚合直接读取 Entity）
   */
  async findCategoryNamesByIds(
    categoryIds: number[],
    transactionContext?: PersistenceTransactionContext,
  ): Promise<Record<number, string>> {
    if (categoryIds.length === 0) return {};
    const repo = this.getCategoryRepo(transactionContext);
    const categories = await repo.findBy({ id: In(categoryIds) });
    const map: Record<number, string> = {};
    for (const c of categories) {
      map[c.id] = c.name;
    }
    return map;
  }

  async getCategoryTree(
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogCategoryTreeView[]> {
    const all = await this.listAllCategories(transactionContext);
    return this.buildTree(all);
  }

  // ─── 内部工具 ───

  /**
   * 批量统计各分类下的文章数（分类视图 postCount 字段的数据来源）
   * 从 BlogPostQueryService 迁移至此，打破 BlogPostQueryService ↔ BlogCategoryQueryService 循环依赖
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

  private toView(entity: BlogCategoryEntity, postCount: number): BlogCategoryView {
    return {
      id: entity.id,
      name: entity.name,
      slug: entity.slug,
      description: entity.description,
      parentId: entity.parentId,
      sortOrder: entity.sortOrder,
      postCount,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private buildTree(views: BlogCategoryView[]): BlogCategoryTreeView[] {
    const map = new Map<number, BlogCategoryTreeView>();
    const roots: BlogCategoryTreeView[] = [];

    for (const v of views) {
      map.set(v.id, { ...v, children: [] });
    }

    for (const v of views) {
      const node = map.get(v.id)!;
      if (v.parentId && map.has(v.parentId)) {
        map.get(v.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  private getCategoryRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogCategoryEntity> {
    return transactionContext
      ? getTransactionEntityManager(transactionContext).getRepository(BlogCategoryEntity)
      : this.categoryRepo;
  }

  private getPostRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogPostEntity> {
    return transactionContext
      ? getTransactionEntityManager(transactionContext).getRepository(BlogPostEntity)
      : this.postRepo;
  }
}
