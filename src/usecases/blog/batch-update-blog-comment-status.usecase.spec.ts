// src/usecases/blog/batch-update-blog-comment-status.usecase.spec.ts

import { BlogCommentStatus } from '@app-types/models/blog.types';
import { BlogCommentService } from '@modules/blog/blog-comment.service';
import { BatchUpdateBlogCommentStatusUsecase } from './batch-update-blog-comment-status.usecase';

describe('BatchUpdateBlogCommentStatusUsecase', () => {
  let usecase: BatchUpdateBlogCommentStatusUsecase;
  let commentService: { batchUpdateCommentStatus: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  beforeEach(() => {
    commentService = {
      batchUpdateCommentStatus: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new BatchUpdateBlogCommentStatusUsecase(
      commentService as unknown as BlogCommentService,
      transactionRunner,
    );
  });

  it('应批量更新评论状态并返回更新行数', async () => {
    commentService.batchUpdateCommentStatus.mockResolvedValue(3);

    const result = await usecase.execute({
      ids: [1, 2, 3],
      status: BlogCommentStatus.APPROVED,
    });

    expect(result.updatedCount).toBe(3);
    expect(commentService.batchUpdateCommentStatus).toHaveBeenCalledWith(
      { ids: [1, 2, 3], status: BlogCommentStatus.APPROVED },
      expect.anything(),
    );
  });

  it('ids 为空时 service 返回 0', async () => {
    commentService.batchUpdateCommentStatus.mockResolvedValue(0);

    const result = await usecase.execute({
      ids: [],
      status: BlogCommentStatus.APPROVED,
    });

    expect(result.updatedCount).toBe(0);
  });

  it('部分 id 不存在时应返回实际更新行数', async () => {
    commentService.batchUpdateCommentStatus.mockResolvedValue(2);

    const result = await usecase.execute({
      ids: [1, 2, 999],
      status: BlogCommentStatus.REJECTED,
    });

    expect(result.updatedCount).toBe(2);
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    commentService.batchUpdateCommentStatus.mockResolvedValue(1);

    await usecase.execute({ ids: [1], status: BlogCommentStatus.APPROVED });

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
