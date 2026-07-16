// src/infrastructure/blog-storage/blog-storage.module.ts
// Blog 存储基础设施模块：封装头像生成器、文件存储和上传配置的 DI wiring

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BLOG_AVATAR_GENERATOR_TOKEN } from '@src/modules/blog/contracts/avatar-generator.contract';
import {
  BLOG_FILE_STORAGE_TOKEN,
  BLOG_FILE_UPLOAD_CONFIG_TOKEN,
} from '@src/modules/blog/contracts/file-storage.contract';
import { CravatarAvatarGeneratorAdapter } from './cravatar-avatar-generator.adapter';
import { LocalFileStorageAdapter } from './local-file-storage.adapter';
import { BlogUploadConfigProvider } from './blog-upload-config.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    { provide: BLOG_AVATAR_GENERATOR_TOKEN, useClass: CravatarAvatarGeneratorAdapter },
    { provide: BLOG_FILE_STORAGE_TOKEN, useClass: LocalFileStorageAdapter },
    { provide: BLOG_FILE_UPLOAD_CONFIG_TOKEN, useClass: BlogUploadConfigProvider },
  ],
  exports: [BLOG_AVATAR_GENERATOR_TOKEN, BLOG_FILE_STORAGE_TOKEN, BLOG_FILE_UPLOAD_CONFIG_TOKEN],
})
export class BlogStorageModule {}
