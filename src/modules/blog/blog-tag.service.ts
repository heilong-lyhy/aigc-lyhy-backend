// src/modules/blog/blog-tag.service.ts
// 标签聚合根写服务
// 职责：标签的创建、软删除；不含跨聚合根编排

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Repository } from 'typeorm';
import type { BlogTagWriteResult, CreateBlogTagInput } from './blog.types';
import { BlogTagEntity } from './entities/blog-tag.entity';

@Injectable()
export class BlogTagService {
  constructor(
    @InjectRepository(BlogTagEntity)
    private readonly tagRepo: Repository<BlogTagEntity>,
  ) {}

  async createTag(
    input: CreateBlogTagInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogTagWriteResult> {
    const repo = this.getTagRepo(transactionContext);
    const entity = repo.create({
      name: input.name,
      slug: input.slug,
    });
    const saved = await repo.save(entity);
    return {
      id: saved.id,
      name: saved.name,
      slug: saved.slug,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  async softDeleteTag(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const repo = this.getTagRepo(transactionContext);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) {
      throw new DomainError(BLOG_ERROR.TAG_NOT_FOUND, '标签不存在');
    }
    await repo.softRemove(entity);
  }

  // ─── 内部工具 ───

  private getTagRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogTagEntity> {
    return transactionContext
      ? getTypeOrmEntityManager(transactionContext).getRepository(BlogTagEntity)
      : this.tagRepo;
  }
}
