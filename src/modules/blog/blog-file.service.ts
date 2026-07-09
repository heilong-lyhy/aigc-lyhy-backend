// src/modules/blog/blog-file.service.ts
// 文件聚合根写服务
// 职责：文件上传、删除；通过 FileStorageAdapter boundary contract 实现存储
// 文件类型白名单与大小限制在此服务中校验
// View 映射委托 BlogFileQueryService，避免 toView 重复

import {
  getTransactionEntityManager,
  type PersistenceTransactionContext,
} from '@app-types/common/transaction.types';
import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { UploadBlogFileInput, BlogFileView } from './blog.types';
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
  ): Promise<BlogFileView> {
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
    // 刚创建的记录必然存在
    return this.queryService.getFileById(saved.id, transactionContext) as Promise<BlogFileView>;
  }

  /**
   * 软删除文件记录（事务内操作）
   * 仅删除数据库记录，不删除物理文件
   * @returns 被删除文件的 storagePath，供调用方在事务提交后删除物理文件
   */
  async softDeleteFile(
    id: number,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<string> {
    const repo = this.getFileRepo(transactionContext);
    const entity = await repo.findOne({ where: { id } });
    if (!entity) {
      throw new DomainError(BLOG_ERROR.FILE_NOT_FOUND, '文件不存在');
    }
    await repo.softRemove(entity);
    return entity.storagePath;
  }

  /**
   * 删除物理文件（事务外操作，不可回滚）
   * 物理文件删除失败不影响数据库记录的软删除状态
   * 孤儿文件可通过定期清理任务处理
   */
  async deletePhysicalFile(storagePath: string): Promise<void> {
    await this.fileStorage.deleteFile(storagePath);
  }

  // ─── 内部工具 ───

  private getFileRepo(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<BlogFileEntity> {
    return transactionContext
      ? getTransactionEntityManager(transactionContext).getRepository(BlogFileEntity)
      : this.fileRepo;
  }
}
