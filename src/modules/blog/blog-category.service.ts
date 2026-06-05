// src/modules/blog/blog-category.service.ts
// 分类聚合根写服务：细粒度写操作，事务上下文由 Usecase 传入
// View 映射委托 BlogCategoryQueryService，避免 toView 重复

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Repository } from 'typeorm';
import type {
  CreateBlogCategoryInput,
  UpdateBlogCategoryInput,
  BlogCategoryView,
} from './blog.types';
import { BlogCategoryEntity } from './entities/blog-category.entity';
import { BlogCategoryQueryService } from './queries/blog-category.query.service';

@Injectable()
export class BlogCategoryService {
  constructor(
    @InjectRepository(BlogCategoryEntity)
    private readonly categoryRepo: Repository<BlogCategoryEntity>,
    private readonly queryService: BlogCategoryQueryService,
  ) {}

  async createCategory(
    input: CreateBlogCategoryInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogCategoryView> {
    const repo = this.getRepo(transactionContext);
    const entity = repo.create({
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder ?? 0,
    });
    const saved = await repo.save(entity);
    // 刚创建的记录必然存在
    return this.queryService.findCategoryById(
      saved.id,
      transactionContext,
    ) as Promise<BlogCategoryView>;
  }

  async updateCategory(
    id: number,
    input: UpdateBlogCategoryInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogCategoryView> {
    const repo = this.getRepo(transactionContext);

    const entity = await repo.findOne({ where: { id } });
    if (!entity) {
      throw new DomainError(BLOG_ERROR.CATEGORY_NOT_FOUND, '分类不存在');
    }

    const patch: Partial<BlogCategoryEntity> = {};

    if (input.name !== undefined) patch.name = input.name;
    if (input.slug !== undefined) patch.slug = input.slug;
    if (input.description !== undefined) patch.description = input.description;
    if (input.parentId !== undefined) patch.parentId = input.parentId;
    if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

    if (Object.keys(patch).length === 0) {
      return this.queryService.findCategoryById(
        id,
        transactionContext,
      ) as Promise<BlogCategoryView>;
    }

    await repo.update(id, patch);
    // 已确认 entity 存在，findCategoryById 不会返回 null
    return this.queryService.findCategoryById(id, transactionContext) as Promise<BlogCategoryView>;
  }

  async softDeleteCategory(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const repo = this.getRepo(transactionContext);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) {
      throw new DomainError(BLOG_ERROR.CATEGORY_NOT_FOUND, '分类不存在');
    }
    await repo.softRemove(entity);
  }

  async updateCategorySortOrder(
    id: number,
    sortOrder: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const repo = this.getRepo(transactionContext);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) {
      throw new DomainError(BLOG_ERROR.CATEGORY_NOT_FOUND, '分类不存在');
    }
    await repo.update(id, { sortOrder });
  }

  // ─── 校验方法 ───

  /**
   * 断言分类下没有关联文章，存在时抛 DomainError(CATEGORY_HAS_POSTS)
   * 通过同域 QueryService 读取文章计数，写侧决策收敛到 service
   */
  async assertHasNoPosts(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const view = await this.queryService.findCategoryById(id, transactionContext);
    if (!view) {
      throw new DomainError(BLOG_ERROR.CATEGORY_NOT_FOUND, '分类不存在');
    }
    if (view.postCount > 0) {
      throw new DomainError(BLOG_ERROR.CATEGORY_HAS_POSTS, '分类下存在文章，无法删除');
    }
  }

  /**
   * 断言 parentId 对应的分类存在，不存在时抛 DomainError(CATEGORY_NOT_FOUND)
   * parentId 为 null/undefined 时跳过（表示顶级分类）
   */
  async assertParentExists(
    parentId: number | null | undefined,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    if (parentId == null) return;
    const repo = this.getRepo(transactionContext);
    const parent = await repo.findOne({ where: { id: parentId } });
    if (!parent) {
      throw new DomainError(BLOG_ERROR.CATEGORY_NOT_FOUND, '父级分类不存在');
    }
  }

  /**
   * 断言设置 parentId 不会形成树形循环引用（自引用或父级是自身后代）
   * 沿 parentId 向上遍历祖先链，若遇到 categoryId 则说明会形成环
   * 使用 Set 去重 + 步数上限防止脏数据导致无限循环
   */
  async assertNoCircularParent(
    categoryId: number,
    parentId: number | null | undefined,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    if (parentId == null) return;
    const repo = this.getRepo(transactionContext);
    const visited = new Set<number>();
    let currentId: number | null = parentId;
    const MAX_DEPTH = 64;
    let depth = 0;
    while (currentId !== null) {
      if (currentId === categoryId || visited.has(currentId)) {
        throw new DomainError(
          BLOG_ERROR.CATEGORY_PARENT_INVALID,
          '不能将分类的父级设为自身或其子分类',
        );
      }
      visited.add(currentId);
      depth++;
      if (depth > MAX_DEPTH) {
        throw new DomainError(
          BLOG_ERROR.CATEGORY_PARENT_INVALID,
          '分类层级深度超过上限，可能存在数据异常',
        );
      }
      const entity = await repo.findOne({ where: { id: currentId } });
      if (!entity) break;
      currentId = entity.parentId;
    }
  }

  /**
   * 断言分类 slug 唯一性，不唯一时抛 DomainError(CATEGORY_SLUG_DUPLICATE)
   * @param slug 待校验的 slug
   * @param excludeId 排除的记录 ID（更新场景排除自身）
   */
  async assertSlugUnique(
    slug: string,
    excludeId?: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const repo = this.getRepo(transactionContext);
    const existing = await repo.findOne({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new DomainError(BLOG_ERROR.CATEGORY_SLUG_DUPLICATE, '分类 slug 已存在');
    }
  }

  // ─── 内部工具 ───

  private getRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogCategoryEntity> {
    return transactionContext
      ? getTypeOrmEntityManager(transactionContext).getRepository(BlogCategoryEntity)
      : this.categoryRepo;
  }
}
