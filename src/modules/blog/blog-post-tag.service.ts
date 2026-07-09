// src/modules/blog/blog-post-tag.service.ts
// 文章-标签关联写服务（BlogPost 聚合内子实体写入）
// 职责：syncPostTags 批量同步文章标签关联；不含 Tag 聚合根写入
// Tag 聚合根写入由 BlogTagService 承载

import {
  getTransactionEntityManager,
  type PersistenceTransactionContext,
} from '@app-types/common/transaction.types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogPostTagEntity } from './entities/blog-post-tag.entity';

@Injectable()
export class BlogPostTagService {
  constructor(
    @InjectRepository(BlogPostTagEntity)
    private readonly postTagRepo: Repository<BlogPostTagEntity>,
  ) {}

  /**
   * 批量同步文章标签关联
   * 内存 diff 后批量 insert/delete，避免 N+1
   */
  async syncPostTags(
    postId: number,
    tagIds: number[],
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const ptRepo = this.getPostTagRepo(transactionContext);

    const existing = await ptRepo.find({
      where: { postId },
      select: { id: true, tagId: true },
    });
    const existingTagIds = new Set(existing.map((e) => e.tagId));

    const toAdd = tagIds.filter((id) => !existingTagIds.has(id));
    const toRemove = existing.filter((e) => !tagIds.includes(e.tagId));

    if (toRemove.length > 0) {
      const removeIds = toRemove.map((e) => e.id);
      await ptRepo.delete(removeIds);
    }

    if (toAdd.length > 0) {
      const entities = ptRepo.create(toAdd.map((tagId) => ({ postId, tagId })));
      await ptRepo.save(entities);
    }
  }

  /**
   * 删除指定文章的所有标签关联（用于文章永久删除时清理）
   */
  async deleteByPostId(
    postId: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const ptRepo = this.getPostTagRepo(transactionContext);
    await ptRepo.delete({ postId });
  }

  // ─── 内部工具 ───

  private getPostTagRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogPostTagEntity> {
    return transactionContext
      ? getTransactionEntityManager(transactionContext).getRepository(BlogPostTagEntity)
      : this.postTagRepo;
  }
}
