// src/usecases/blog/upload-blog-file.usecase.ts
// 文件上传用例：编排 BlogFile 聚合根写入
// BlogFileService 内部完成文件类型白名单校验、大小限制校验、存储文件、记录文件信息
// 不持有事务边界（文件存储为外部系统操作，不参与数据库事务）
//
// 一致性策略：先存物理文件再入库
// - 若入库失败，物理文件成为孤儿文件，可通过定期清理任务处理
// - 不采用"先入库再存物理文件"策略，因为 DB 记录指向不存在的物理文件比孤儿文件更严重

import { Injectable } from '@nestjs/common';
import { BlogFileService } from '@src/modules/blog/blog-file.service';
import type { BlogFileView, UploadBlogFileInput } from '@src/modules/blog/blog.types';

export interface UploadBlogFileResult {
  readonly file: BlogFileView;
}

@Injectable()
export class UploadBlogFileUsecase {
  constructor(private readonly fileService: BlogFileService) {}

  async execute(input: UploadBlogFileInput & { buffer: Buffer }): Promise<UploadBlogFileResult> {
    // BlogFileService.uploadFile 内部完成：
    // 1. 文件类型白名单校验
    // 2. 文件大小限制校验
    // 3. 通过 FileStorageAdapter（module-owned boundary contract）存储文件
    // 4. 记录文件信息到数据库
    const file = await this.fileService.uploadFile(input);

    return { file };
  }
}
