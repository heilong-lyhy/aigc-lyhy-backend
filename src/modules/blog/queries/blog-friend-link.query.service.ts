// src/modules/blog/queries/blog-friend-link.query.service.ts
// 友情链接读侧 QueryService：读取、输出规范化，不写、不开事务

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { getTypeOrmEntityManager as getTransactionEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { BlogFriendLinkView } from '../blog.types';
import { BlogFriendLinkEntity } from '../entities/blog-friend-link.entity';

@Injectable()
export class BlogFriendLinkQueryService {
  constructor(
    @InjectRepository(BlogFriendLinkEntity)
    private readonly friendLinkRepo: Repository<BlogFriendLinkEntity>,
  ) {}

  async findFriendLinkById(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogFriendLinkView | null> {
    const repo = this.getRepo(transactionContext);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) return null;
    return this.toView(entity);
  }

  /** 查询所有启用的友链（公开接口，按 sortOrder ASC 排序） */
  async listActiveFriendLinks(
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogFriendLinkView[]> {
    const repo = this.getRepo(transactionContext);
    const entities = await repo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return entities.map((e) => this.toView(e));
  }

  /** 查询所有友链（管理端，含禁用项，按 sortOrder ASC 排序） */
  async listAllFriendLinks(
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogFriendLinkView[]> {
    const repo = this.getRepo(transactionContext);
    const entities = await repo.find({
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return entities.map((e) => this.toView(e));
  }

  // ─── 内部工具 ───

  private toView(entity: BlogFriendLinkEntity): BlogFriendLinkView {
    return {
      id: entity.id,
      name: entity.name,
      url: entity.url,
      description: entity.description,
      logoUrl: entity.logoUrl,
      sortOrder: entity.sortOrder,
      isActive: entity.isActive,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private getRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogFriendLinkEntity> {
    return transactionContext
      ? getTransactionEntityManager(transactionContext).getRepository(BlogFriendLinkEntity)
      : this.friendLinkRepo;
  }
}
