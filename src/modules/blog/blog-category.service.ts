// src/modules/blog/blog-category.service.ts
// 分类聚合根写服务：细粒度写操作，事务上下文由 Usecase 传入

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Repository } from 'typeorm';
import type {
  CreateBlogCategoryInput,
  UpdateBlogCategoryInput,
  BlogCategoryWriteResult,
} from './blog.types';
import { BlogCategoryEntity } from './entities/blog-category.entity';

@Injectable()
export class BlogCategoryService {
  constructor(
    @InjectRepository(BlogCategoryEntity)
    private readonly categoryRepo: Repository<BlogCategoryEntity>,
  ) {}

  async createCategory(
    input: CreateBlogCategoryInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogCategoryWriteResult> {
    const repo = this.getRepo(transactionContext);
    const entity = repo.create({
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder ?? 0,
    });
    const saved = await repo.save(entity);
    return this.toView(saved);
  }

  async updateCategory(
    id: number,
    input: UpdateBlogCategoryInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogCategoryWriteResult> {
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
      return this.toView(entity);
    }

    await repo.update(id, patch);
    const updated = await repo.findOne({ where: { id } });
    if (!updated) {
      throw new DomainError(BLOG_ERROR.CATEGORY_NOT_FOUND, '分类不存在');
    }
    return this.toView(updated);
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

  // ─── 内部工具 ───

  private toView(entity: BlogCategoryEntity): BlogCategoryWriteResult {
    return {
      id: entity.id,
      name: entity.name,
      slug: entity.slug,
      description: entity.description,
      parentId: entity.parentId,
      sortOrder: entity.sortOrder,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private getRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogCategoryEntity> {
    return transactionContext
      ? getTypeOrmEntityManager(transactionContext).getRepository(BlogCategoryEntity)
      : this.categoryRepo;
  }
}
