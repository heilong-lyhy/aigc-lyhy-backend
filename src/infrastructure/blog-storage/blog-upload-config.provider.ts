// src/infrastructure/blog-storage/blog-upload-config.provider.ts
// BlogFileUploadConfig boundary contract 的 infrastructure 实现
// 从 ConfigService 读取配置，通过 DI 注入到 modules 层

import type { BlogFileUploadConfig } from '@src/modules/blog/contracts/file-storage.contract';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BlogUploadConfigProvider implements BlogFileUploadConfig {
  readonly allowedMimeTypes: readonly string[];
  readonly maxFileSize: number;

  constructor(private readonly configService: ConfigService) {
    this.allowedMimeTypes = this.configService.get<readonly string[]>(
      'blogStorage.allowedMimeTypes',
    )!;
    this.maxFileSize = this.configService.get<number>('blogStorage.maxFileSize')!;
  }
}
