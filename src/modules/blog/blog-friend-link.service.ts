// src/modules/blog/blog-friend-link.service.ts
// 友情链接聚合根写服务：细粒度写操作，事务上下文由 Usecase 传入
// View 映射委托 BlogFriendLinkQueryService，避免 toView 重复

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Repository } from 'typeorm';
import type {
  CreateBlogFriendLinkInput,
  UpdateBlogFriendLinkInput,
  BlogFriendLinkView,
} from './blog.types';
import { BlogFriendLinkEntity } from './entities/blog-friend-link.entity';
import { BlogFriendLinkQueryService } from './queries/blog-friend-link.query.service';

@Injectable()
export class BlogFriendLinkService {
  constructor(
    @InjectRepository(BlogFriendLinkEntity)
    private readonly friendLinkRepo: Repository<BlogFriendLinkEntity>,
    private readonly queryService: BlogFriendLinkQueryService,
  ) {}

  async createFriendLink(
    input: CreateBlogFriendLinkInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogFriendLinkView> {
    const repo = this.getRepo(transactionContext);
    const entity = repo.create({
      name: input.name,
      url: input.url,
      description: input.description ?? null,
      logoUrl: input.logoUrl ?? null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
    });
    const saved = await repo.save(entity);
    return this.queryService.findFriendLinkById(
      saved.id,
      transactionContext,
    ) as Promise<BlogFriendLinkView>;
  }

  async updateFriendLink(
    id: number,
    input: Omit<UpdateBlogFriendLinkInput, 'id'>,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogFriendLinkView> {
    const repo = this.getRepo(transactionContext);

    const entity = await repo.findOne({ where: { id } });
    if (!entity) {
      throw new DomainError(BLOG_ERROR.FRIEND_LINK_NOT_FOUND, '友情链接不存在');
    }

    const patch: Partial<BlogFriendLinkEntity> = {};

    if (input.name !== undefined) patch.name = input.name;
    if (input.url !== undefined) patch.url = input.url;
    if (input.description !== undefined) patch.description = input.description;
    if (input.logoUrl !== undefined) patch.logoUrl = input.logoUrl;
    if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
    if (input.isActive !== undefined) patch.isActive = input.isActive;

    if (Object.keys(patch).length === 0) {
      return this.queryService.findFriendLinkById(
        id,
        transactionContext,
      ) as Promise<BlogFriendLinkView>;
    }

    await repo.update(id, patch);
    return this.queryService.findFriendLinkById(
      id,
      transactionContext,
    ) as Promise<BlogFriendLinkView>;
  }

  async softDeleteFriendLink(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const repo = this.getRepo(transactionContext);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) {
      throw new DomainError(BLOG_ERROR.FRIEND_LINK_NOT_FOUND, '友情链接不存在');
    }
    await repo.softRemove(entity);
  }

  // ─── 内部工具 ───

  private getRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogFriendLinkEntity> {
    return transactionContext
      ? getTypeOrmEntityManager(transactionContext).getRepository(BlogFriendLinkEntity)
      : this.friendLinkRepo;
  }
}
