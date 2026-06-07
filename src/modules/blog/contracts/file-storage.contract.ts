// src/modules/blog/contracts/file-storage.contract.ts
// Module-owned boundary contract：博客文件存储能力
// Blog 模块需要隔离可替换的文件存储实现（本地/OSS/S3），由 infrastructure 层提供具体实现

import type { BlogFileType } from '@app-types/models/blog.types';

/** DI token for FileStorageAdapter */
export const BLOG_FILE_STORAGE_TOKEN = Symbol('FileStorageAdapter');

export interface FileStorageAdapter {
  /**
   * 保存文件到存储后端
   * @param file 文件数据
   * @returns 存储路径
   */
  saveFile(file: SaveFileInput): Promise<string>;

  /**
   * 从存储后端删除文件
   * @param storagePath 文件存储路径
   */
  deleteFile(storagePath: string): Promise<void>;

  /**
   * 获取文件访问 URL
   * @param storagePath 文件存储路径
   * @returns 可访问的 URL
   */
  getFileUrl(storagePath: string): Promise<string>;
}

export interface SaveFileInput {
  readonly buffer: Buffer;
  readonly originalName: string;
  readonly mimeType: string;
  readonly fileType: BlogFileType;
  readonly storedName: string;
}

// ─── 文件上传配置 boundary contract ───

/** DI token for BlogFileUploadConfig */
export const BLOG_FILE_UPLOAD_CONFIG_TOKEN = Symbol('BlogFileUploadConfig');

/** 文件上传配置（由 infrastructure 层从 ConfigService 读取并注入） */
export interface BlogFileUploadConfig {
  /** 允许上传的 MIME 类型白名单 */
  readonly allowedMimeTypes: readonly string[];
  /** 最大文件大小（字节） */
  readonly maxFileSize: number;
}
