// src/modules/blog/queries/blog-profile.query.service.ts
// 博主信息读侧 QueryService：读取、输出规范化，不写、不开事务

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Repository } from 'typeorm';
import type { BlogProfileView } from '../blog.types';
import { BlogProfileEntity } from '../entities/blog-profile.entity';

@Injectable()
export class BlogProfileQueryService {
  constructor(
    @InjectRepository(BlogProfileEntity)
    private readonly profileRepo: Repository<BlogProfileEntity>,
  ) {}

  /**
   * 查询博主信息（单例，取第一条记录）
   */
  async getProfile(
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogProfileView | null> {
    const repo = this.getProfileRepo(transactionContext);
    const entity = await repo.findOne({ order: { id: 'ASC' } });
    if (!entity) return null;
    return this.toView(entity);
  }

  /**
   * 按 ID 查询博主信息
   */
  async findProfileById(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogProfileView | null> {
    const repo = this.getProfileRepo(transactionContext);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) return null;
    return this.toView(entity);
  }

  // ─── 内部工具 ───

  private toView(entity: BlogProfileEntity): BlogProfileView {
    return {
      id: entity.id,
      nickname: entity.nickname,
      bio: entity.bio,
      avatarUrl: entity.avatarUrl,
      socialLinks: entity.socialLinks,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private getProfileRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogProfileEntity> {
    return transactionContext
      ? getTypeOrmEntityManager(transactionContext).getRepository(BlogProfileEntity)
      : this.profileRepo;
  }
}
