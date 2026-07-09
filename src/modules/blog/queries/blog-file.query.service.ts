// src/modules/blog/queries/blog-file.query.service.ts
// 文件读侧 QueryService：读取、输出规范化、分页编排，不写、不开事务

import {
  getTransactionEntityManager,
  type PersistenceTransactionContext,
} from '@app-types/common/transaction.types';
import { BlogFileType } from '@app-types/models/blog.types';
import type { PaginatedResult } from '@core/pagination/pagination.types';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaginationService } from '@modules/common/pagination.service';
import { Repository } from 'typeorm';
import type { BlogFileView } from '../blog.types';
import { BlogFileEntity } from '../entities/blog-file.entity';

export interface BlogFilePaginationParams {
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy?: string;
  readonly sortOrder?: 'ASC' | 'DESC';
  readonly fileType?: BlogFileType;
}

const FILE_SORT_COLUMN_MAP: Record<string, string> = {
  createdAt: 'file.created_at',
  updatedAt: 'file.updated_at',
  fileSize: 'file.file_size',
};

const FILE_ALLOWED_SORTS = ['createdAt', 'updatedAt', 'fileSize'];

@Injectable()
export class BlogFileQueryService {
  constructor(
    @InjectRepository(BlogFileEntity)
    private readonly fileRepo: Repository<BlogFileEntity>,
    private readonly paginationService: PaginationService,
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
   * 文件分页查询：在 QueryService 内完成分页编排
   */
  async paginateFiles(params: BlogFilePaginationParams): Promise<PaginatedResult<BlogFileView>> {
    const qb = this.fileRepo.createQueryBuilder('file');

    if (params.fileType !== undefined) {
      qb.andWhere('file.file_type = :fileType', { fileType: params.fileType });
    }

    const result = await this.paginationService.paginateQuery({
      qb,
      params: {
        mode: 'OFFSET',
        page: params.page,
        pageSize: params.pageSize,
        withTotal: true,
        sorts: params.sortBy
          ? [{ field: params.sortBy, direction: params.sortOrder ?? 'DESC' }]
          : [{ field: 'createdAt', direction: 'DESC' }],
      },
      allowedSorts: FILE_ALLOWED_SORTS,
      defaultSorts: [{ field: 'createdAt', direction: 'DESC' }],
      resolveColumn: (field: string) => FILE_SORT_COLUMN_MAP[field] ?? null,
    });

    return {
      ...result,
      items: result.items.map((e) => this.toView(e)),
    };
  }

  /**
   * 将 Entity 映射为 View（供 Usecase 分页后调用）
   */
  toView(entity: BlogFileEntity): BlogFileView {
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
      ? getTransactionEntityManager(transactionContext).getRepository(BlogFileEntity)
      : this.fileRepo;
  }
}
