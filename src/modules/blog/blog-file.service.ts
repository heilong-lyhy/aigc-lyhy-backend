// src/modules/blog/blog-file.service.ts
// 文件聚合根写服务
// 职责：文件上传、删除；通过 FileStorageAdapter boundary contract 实现存储
// 文件类型白名单与大小限制在此服务中校验
// View 映射委托 BlogFileQueryService，避免 toView 重复

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Repository } from 'typeorm';
import type { UploadBlogFileInput } from './blog.types';
import {
  BLOG_FILE_STORAGE_TOKEN,
  type FileStorageAdapter,
  BLOG_FILE_UPLOAD_CONFIG_TOKEN,
  type BlogFileUploadConfig,
} from './contracts/file-storage.contract';
import { BlogFileEntity } from './entities/blog-file.entity';
import { BlogFileQueryService } from './queries/blog-file.query.service';

@Injectable()
export class BlogFileService {
  private readonly allowedMimeTypes: readonly string[];
  private readonly maxFileSize: number;

  constructor(
    @InjectRepository(BlogFileEntity)
    private readonly fileRepo: Repository<BlogFileEntity>,
    @Inject(BLOG_FILE_STORAGE_TOKEN)
    private readonly fileStorage: FileStorageAdapter,
    @Inject(BLOG_FILE_UPLOAD_CONFIG_TOKEN)
    private readonly uploadConfig: BlogFileUploadConfig,
    private readonly queryService: BlogFileQueryService,
  ) {
    this.allowedMimeTypes = this.uploadConfig.allowedMimeTypes;
    this.maxFileSize = this.uploadConfig.maxFileSize;
  }

  async uploadFile(
    input: UploadBlogFileInput & { buffer: Buffer },
    transactionContext?: PersistenceTransactionContext,
  ) {
    // 文件类型白名单校验
    if (!this.allowedMimeTypes.includes(input.mimeType)) {
      throw new DomainError(BLOG_ERROR.FILE_TYPE_NOT_ALLOWED, '不支持的文件类型');
    }

    // 文件大小限制校验
    if (input.fileSize > this.maxFileSize) {
      throw new DomainError(BLOG_ERROR.FILE_SIZE_EXCEEDED, '文件大小超过限制');
    }

    // 通过 FileStorageAdapter 保存文件到存储后端
    const storagePath = await this.fileStorage.saveFile({
      buffer: input.buffer,
      originalName: input.originalName,
      mimeType: input.mimeType,
      fileType: input.fileType,
      storedName: input.storedName,
    });

    const repo = this.getFileRepo(transactionContext);
    const entity = repo.create({
      originalName: input.originalName,
      storedName: input.storedName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      storagePath,
      fileType: input.fileType,
    });

    const saved = await repo.save(entity);
    return this.queryService.getFileById(saved.id, transactionContext);
  }

  async deleteFile(id: number, transactionContext?: PersistenceTransactionContext): Promise<void> {
    const repo = this.getFileRepo(transactionContext);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) {
      throw new DomainError(BLOG_ERROR.FILE_NOT_FOUND, '文件不存在');
    }

    // 先从存储后端删除物理文件
    await this.fileStorage.deleteFile(entity.storagePath);
    // 再软删除数据库记录
    await repo.softRemove(entity);
  }

  // ─── 内部工具 ───

  private getFileRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogFileEntity> {
    return transactionContext
      ? getTypeOrmEntityManager(transactionContext).getRepository(BlogFileEntity)
      : this.fileRepo;
  }
}
