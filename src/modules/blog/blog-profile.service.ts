// src/modules/blog/blog-profile.service.ts
// 博主信息聚合根写服务（单例聚合根）
// 职责：博主信息的创建、更新；不含跨聚合根编排

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Repository } from 'typeorm';
import type { BlogProfileView, UpdateBlogProfileInput } from './blog.types';
import { BlogProfileEntity } from './entities/blog-profile.entity';

@Injectable()
export class BlogProfileService {
  constructor(
    @InjectRepository(BlogProfileEntity)
    private readonly profileRepo: Repository<BlogProfileEntity>,
  ) {}

  async createProfile(
    nickname: string,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogProfileView> {
    const repo = this.getProfileRepo(transactionContext);
    const entity = repo.create({ nickname });
    const saved = await repo.save(entity);
    return this.toView(saved);
  }

  async updateProfile(
    id: number,
    input: UpdateBlogProfileInput,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogProfileView> {
    const repo = this.getProfileRepo(transactionContext);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) {
      throw new DomainError(BLOG_ERROR.PROFILE_NOT_FOUND, '博主信息不存在');
    }

    const patch: Partial<BlogProfileEntity> = {};
    if (input.nickname !== undefined) patch.nickname = input.nickname;
    if (input.bio !== undefined) patch.bio = input.bio;
    if (input.avatarUrl !== undefined) patch.avatarUrl = input.avatarUrl;
    if (input.socialLinks !== undefined) patch.socialLinks = input.socialLinks;

    if (Object.keys(patch).length === 0) {
      return this.toView(entity);
    }

    await repo.update(id, patch);
    const updated = await repo.findOne({ where: { id } });
    if (!updated) {
      throw new DomainError(BLOG_ERROR.PROFILE_NOT_FOUND, '博主信息不存在');
    }
    return this.toView(updated);
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
