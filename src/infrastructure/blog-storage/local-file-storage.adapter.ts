// src/infrastructure/blog-storage/local-file-storage.adapter.ts
// FileStorageAdapter boundary contract 的本地文件系统实现

import type {
  FileStorageAdapter,
  SaveFileInput,
} from '@modules/blog/contracts/file-storage.contract';
import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile, unlink, access } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class LocalFileStorageAdapter implements FileStorageAdapter {
  private readonly uploadBaseDir: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadBaseDir = this.configService.get<string>('blogStorage.uploadBaseDir')!;
  }
  async saveFile(file: SaveFileInput): Promise<string> {
    const dir = this.getDirectory(file.fileType);
    const fullPath = join(dir, file.storedName);

    // 确保目录存在
    await mkdir(dir, { recursive: true });

    try {
      await writeFile(fullPath, file.buffer);
      return join(file.fileType.toLowerCase(), file.storedName);
    } catch {
      throw new DomainError(BLOG_ERROR.FILE_UPLOAD_FAILED, '文件保存失败');
    }
  }

  async deleteFile(storagePath: string): Promise<void> {
    const fullPath = join(this.uploadBaseDir, storagePath);
    try {
      await access(fullPath);
      await unlink(fullPath);
    } catch {
      // 文件不存在时静默处理，不抛异常
    }
  }

  getFileUrl(storagePath: string): Promise<string> {
    return Promise.resolve(`/uploads/blog/${storagePath}`);
  }

  private getDirectory(fileType: string): string {
    return join(this.uploadBaseDir, fileType.toLowerCase());
  }
}
