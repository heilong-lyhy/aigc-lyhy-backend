// src/modules/blog/queries/blog-file.query.service.ts
// 文件读侧 QueryService：读取、输出规范化，不写、不开事务

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Repository } from 'typeorm';
import type { BlogFileView } from '../blog.types';
import { BlogFileEntity } from '../entities/blog-file.entity';

@Injectable()
export class BlogFileQueryService {
  constructor(
    @InjectRepository(BlogFileEntity)
    private readonly fileRepo: Repository<BlogFileEntity>,
  ) {}

  async getFileById(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<BlogFileView | null> {
    const repo = this.getFileRepo(transactionContext);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) return null;
    return this.toView(entity);
  }

  /**
   * 查询文件列表（分页由 Usecase 编排 PaginationService）
   */
  async listFiles(transactionContext?: PersistenceTransactionContext): Promise<BlogFileView[]> {
    const repo = this.getFileRepo(transactionContext);
    const entities = await repo.find({
      order: { createdAt: 'DESC' },
    });
    return entities.map((e) => this.toView(e));
  }

  // ─── 内部工具 ───

  private toView(entity: BlogFileEntity): BlogFileView {
    return {
      id: entity.id,
      originalName: entity.originalName,
      storedName: entity.storedName,
      mimeType: entity.mimeType,
      fileSize: entity.fileSize,
      storagePath: entity.storagePath,
      fileType: entity.fileType,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private getFileRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogFileEntity> {
    return transactionContext
      ? getTypeOrmEntityManager(transactionContext).getRepository(BlogFileEntity)
      : this.fileRepo;
  }
}
