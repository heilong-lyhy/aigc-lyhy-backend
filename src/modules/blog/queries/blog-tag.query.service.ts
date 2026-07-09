// src/modules/blog/queries/blog-tag.query.service.ts
// 标签读侧 QueryService：读取、输出规范化，不写、不开事务

import {
  getTransactionEntityManager,
  type PersistenceTransactionContext,
} from '@app-types/common/transaction.types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { BlogTagView } from '../blog.types';
import { BlogPostTagEntity } from '../entities/blog-post-tag.entity';
import { BlogTagEntity } from '../entities/blog-tag.entity';

@Injectable()
export class BlogTagQueryService {
  constructor(
    @InjectRepository(BlogTagEntity)
    private readonly tagRepo: Repository<BlogTagEntity>,
    @InjectRepository(BlogPostTagEntity)
    private readonly postTagRepo: Repository<BlogPostTagEntity>,
  ) {}

  async findTagById(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogTagView | null> {
    const repo = this.getTagRepo(transactionContext);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) return null;
    const postCounts = await this.getPostCountsByTags([id], transactionContext);
    return this.toView(entity, postCounts[id] ?? 0);
  }

  async findTagBySlug(
    slug: string,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogTagView | null> {
    const repo = this.getTagRepo(transactionContext);
    const entity = await repo.findOne({ where: { slug } });
    if (!entity) return null;
    const postCounts = await this.getPostCountsByTags([entity.id], transactionContext);
    return this.toView(entity, postCounts[entity.id] ?? 0);
  }

  async listAllTags(transactionContext?: PersistenceTransactionContext): Promise<BlogTagView[]> {
    const repo = this.getTagRepo(transactionContext);
    const entities = await repo.find({
      order: { createdAt: 'ASC' },
    });
    const postCounts = await this.getPostCountsByTags(
      entities.map((e) => e.id),
      transactionContext,
    );
    return entities.map((e) => this.toView(e, postCounts[e.id] ?? 0));
  }

  /**
   * 查询指定文章关联的标签视图列表
   * TypeORM 自动过滤已软删除的 BlogTagEntity
   */
  async findTagsByPostId(
    postId: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogTagView[]> {
    const ptRepo = this.getPostTagRepo(transactionContext);
    const tagRepo = this.getTagRepo(transactionContext);

    const postTags = await ptRepo.find({ where: { postId } });
    if (postTags.length === 0) return [];

    const tagIds = postTags.map((pt) => pt.tagId);
    const tags = await tagRepo.findBy({ id: In(tagIds) });
    if (tags.length === 0) return [];

    const postCounts = await this.getPostCountsByTags(
      tags.map((t) => t.id),
      transactionContext,
    );
    return tags.map((t) => this.toView(t, postCounts[t.id] ?? 0));
  }

  // ─── 内部工具 ───

  private toView(entity: BlogTagEntity, postCount: number): BlogTagView {
    return {
      id: entity.id,
      name: entity.name,
      slug: entity.slug,
      postCount,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /**
   * 批量查询标签下的文章数
   * 使用 createQueryBuilder + GROUP BY 聚合，需手动过滤软删除
   */
  private async getPostCountsByTags(
    tagIds: number[],
    transactionContext?: PersistenceTransactionContext,
  ): Promise<Record<number, number>> {
    if (tagIds.length === 0) return {};
    const ptRepo = this.getPostTagRepo(transactionContext);
    const result = await ptRepo
      .createQueryBuilder('pt')
      .select('pt.tag_id', 'tagId')
      .addSelect('COUNT(*)', 'count')
      .where('pt.tag_id IN (:...ids)', { ids: tagIds })
      .groupBy('pt.tag_id')
      .getRawMany<{ tagId: number; count: string }>();

    const map: Record<number, number> = {};
    for (const row of result) {
      map[row.tagId] = Number(row.count);
    }
    return map;
  }

  private getTagRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogTagEntity> {
    return transactionContext
      ? getTransactionEntityManager(transactionContext).getRepository(BlogTagEntity)
      : this.tagRepo;
  }

  private getPostTagRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogPostTagEntity> {
    return transactionContext
      ? getTransactionEntityManager(transactionContext).getRepository(BlogPostTagEntity)
      : this.postTagRepo;
  }
}
