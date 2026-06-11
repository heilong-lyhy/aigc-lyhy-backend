// src/modules/blog/blog-tag.service.ts
// 标签聚合根写服务
// 职责：标签的创建、更新、软删除；不含跨聚合根编排
// View 映射委托 BlogTagQueryService，避免 toView 重复

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CreateBlogTagInput, UpdateBlogTagInput, BlogTagView } from './blog.types';
import { BlogTagEntity } from './entities/blog-tag.entity';
import { BlogTagQueryService } from './queries/blog-tag.query.service';
import { assertSlugUnique, getTransactionalRepo } from './slug-uniqueness.helper';

@Injectable()
export class BlogTagService {
  constructor(
    @InjectRepository(BlogTagEntity)
    private readonly tagRepo: Repository<BlogTagEntity>,
    private readonly queryService: BlogTagQueryService,
  ) {}

  async createTag(
    input: CreateBlogTagInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogTagView> {
    const repo = getTransactionalRepo(BlogTagEntity, this.tagRepo, transactionContext);
    const entity = repo.create({
      name: input.name,
      slug: input.slug,
    });
    const saved = await repo.save(entity);
    // 刚创建的记录必然存在
    return this.queryService.findTagById(saved.id, transactionContext) as Promise<BlogTagView>;
  }

  async softDeleteTag(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const repo = getTransactionalRepo(BlogTagEntity, this.tagRepo, transactionContext);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) {
      throw new DomainError(BLOG_ERROR.TAG_NOT_FOUND, '标签不存在');
    }
    await repo.softRemove(entity);
  }

  async updateTag(
    id: number,
    input: UpdateBlogTagInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogTagView> {
    const repo = getTransactionalRepo(BlogTagEntity, this.tagRepo, transactionContext);

    const entity = await repo.findOne({ where: { id } });
    if (!entity) {
      throw new DomainError(BLOG_ERROR.TAG_NOT_FOUND, '标签不存在');
    }

    const patch: Partial<BlogTagEntity> = {};

    if (input.name !== undefined) patch.name = input.name;
    if (input.slug !== undefined) patch.slug = input.slug;

    if (Object.keys(patch).length === 0) {
      return this.queryService.findTagById(id, transactionContext) as Promise<BlogTagView>;
    }

    await repo.update(id, patch);
    // 已确认 entity 存在，findTagById 不会返回 null
    return this.queryService.findTagById(id, transactionContext) as Promise<BlogTagView>;
  }

  // ─── 校验方法 ───

  /**
   * 断言标签下没有关联文章，存在时抛 DomainError(TAG_HAS_POSTS)
   * 通过同域 QueryService 读取文章计数，写侧决策收敛到 service
   */
  async assertHasNoPostLinks(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const view = await this.queryService.findTagById(id, transactionContext);
    if (!view) {
      throw new DomainError(BLOG_ERROR.TAG_NOT_FOUND, '标签不存在');
    }
    if (view.postCount > 0) {
      throw new DomainError(BLOG_ERROR.TAG_HAS_POSTS, '标签下存在文章，无法删除');
    }
  }

  /**
   * 断言标签 slug 唯一性，不唯一时抛 DomainError(TAG_SLUG_DUPLICATE)
   * @param slug 待校验的 slug
   * @param excludeId 排除的记录 ID（更新场景排除自身）
   */
  async assertSlugUnique(
    slug: string,
    excludeId?: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const repo = getTransactionalRepo(BlogTagEntity, this.tagRepo, transactionContext);
    await assertSlugUnique(
      repo,
      slug,
      BLOG_ERROR.TAG_SLUG_DUPLICATE,
      '标签 slug 已存在',
      excludeId,
    );
  }
}
