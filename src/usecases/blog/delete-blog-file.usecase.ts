// src/usecases/blog/delete-blog-file.usecase.ts
// 文件删除用例：编排 BlogFile 聚合根删除
// 一致性策略：事务内软删除数据库记录 → 事务提交后删除物理文件
// 物理文件删除失败不影响数据库软删除状态，孤儿文件可通过定期清理任务处理

import { Inject, Injectable } from '@nestjs/common';
import { BlogFileService } from '@modules/blog/blog-file.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@usecases/common/ports/transaction-runner.contract';

@Injectable()
export class DeleteBlogFileUsecase {
  constructor(
    private readonly fileService: BlogFileService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(id: number): Promise<void> {
    // 1. 事务内：软删除数据库记录，返回 storagePath
    const storagePath = await this.transactionRunner.run(async (transactionContext) => {
      return this.fileService.softDeleteFile(id, transactionContext);
    });

    // 2. 事务提交后：删除物理文件（不可回滚，失败时产生孤儿文件，由定期清理任务处理）
    await this.fileService.deletePhysicalFile(storagePath);
  }
}
