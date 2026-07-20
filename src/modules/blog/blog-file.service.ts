// src/modules/blog/blog-file.service.ts
// 文件聚合根写服务
// 职责：文件上传、删除；通过 FileStorageAdapter boundary contract 实现存储
// 文件类型白名单与大小限制在此服务中校验
// View 映射委托 BlogFileQueryService，避免 toView 重复

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import { getTypeOrmEntityManager as getTransactionEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
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

/**
 * Magic bytes → MIME 类型映射表
 * 用于校验客户端声明的 mimeType 与文件实际内容是否一致，防止：
 * 1. 攻击者把 .exe 改名 .jpg 上传（绕过基于扩展名/mime 头的校验）
 * 2. 上传伪装成图片的恶意脚本（如 polyglot 文件）
 *
 * 仅校验声明的 MIME 是否与文件头匹配，不做完整文件结构验证（那是更上层职责）
 */
const MAGIC_BYTES_TO_MIME: ReadonlyArray<{ readonly bytes: number[]; readonly mime: string }> = [
  // 图片
  { bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: 'image/png' },
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif' }, // GIF8
  { bytes: [0x42, 0x4d], mime: 'image/bmp' }, // BM
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' }, // RIFF....WEBP（前 4 字节）
  // 文档
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf' }, // %PDF
];

/**
 * 通过文件头（magic bytes）检测实际 MIME 类型
 * @param buffer 文件二进制内容（前 16 字节即可）
 * @returns 检测到的 MIME 类型；未匹配返回 null
 */
function detectMimeTypeByMagicBytes(buffer: Buffer): string | null {
  for (const { bytes, mime } of MAGIC_BYTES_TO_MIME) {
    if (buffer.length < bytes.length) continue;
    let matched = true;
    for (let i = 0; i < bytes.length; i++) {
      if (buffer[i] !== bytes[i]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return mime;
    }
  }
  return null;
}

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

    // 关键安全校验：magic bytes 验证
    // 攻击场景：客户端把 evil.exe 改名 evil.jpg，Content-Type: image/jpeg
    // 仅检查 mimeType 字段会被绕过，必须读文件头比对
    const detectedMime = detectMimeTypeByMagicBytes(input.buffer);
    if (detectedMime !== null && detectedMime !== input.mimeType) {
      // 声明是 image/jpeg 但实际是 image/png 等 → 视为伪装攻击，拒绝
      throw new DomainError(BLOG_ERROR.FILE_TYPE_NOT_ALLOWED, '文件内容与声明类型不一致');
    }
    // 若 detectedMime === null，说明该类型未在 magic bytes 表中（如 text/plain），
    // 此处不阻断；调用方应确保 allowedMimeTypes 仅包含可信类型

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
