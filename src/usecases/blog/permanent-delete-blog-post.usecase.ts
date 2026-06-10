// src/usecases/blog/permanent-delete-blog-post.usecase.ts
// 永久删除文章用例：从数据库彻底删除文章及关联数据
// 持有事务边界，通过 TransactionRunner 开启事务
// 存在性校验与软删除状态校验由 BlogPostService.permanentDeletePost 内部完成，usecase 不重复校验
// 聚合内子实体（BlogPostTag）删除由 BlogPostService.permanentDeletePost 内部编排

import { Inject, Injectable } from '@nestjs/common';
import { BlogPostService } from '@src/modules/blog/blog-post.service';
import { BlogCommentService } from '@src/modules/blog/blog-comment.service';
import { BlogLikeService } from '@src/modules/blog/blog-like.service';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '@src/usecases/common/ports/transaction-runner.contract';

export interface PermanentDeleteBlogPostResult {
  readonly deleted: boolean;
}

@Injectable()
export class PermanentDeleteBlogPostUsecase {
  constructor(
    private readonly postService: BlogPostService,
    private readonly commentService: BlogCommentService,
    private readonly likeService: BlogLikeService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(id: number): Promise<PermanentDeleteBlogPostResult> {
    return this.transactionRunner.run(async (transactionContext) => {
      // 级联删除独立聚合根的关联数据
      await this.commentService.permanentDeleteCommentsByPostId(id, transactionContext);
      await this.likeService.deleteLikesByPostId(id, transactionContext);

      // 永久删除文章（内部编排聚合内子实体 BlogPostTag 的清理）
      await this.postService.permanentDeletePost(id, transactionContext);

      return { deleted: true };
    });
  }
}
