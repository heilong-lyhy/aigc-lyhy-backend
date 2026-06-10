// src/usecases/blog/hide-blog-comment.usecase.spec.ts

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { BlogCommentService } from '@src/modules/blog/blog-comment.service';
import { HideBlogCommentUsecase } from './hide-blog-comment.usecase';

describe('HideBlogCommentUsecase', () => {
  let usecase: HideBlogCommentUsecase;
  let commentService: { hideComment: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  beforeEach(() => {
    commentService = {
      hideComment: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new HideBlogCommentUsecase(
      commentService as unknown as BlogCommentService,
      transactionRunner,
    );
  });

  it('应在事务内隐藏评论', async () => {
    const mockView = { id: 1, isHidden: true };
    commentService.hideComment.mockResolvedValue(mockView);

    const result = await usecase.execute(1);

    expect(result.comment).toEqual(mockView);
    expect(commentService.hideComment).toHaveBeenCalledWith(1, expect.anything());
  });

  it('评论不存在时应抛出 DomainError', async () => {
    commentService.hideComment.mockRejectedValue(
      new DomainError(BLOG_ERROR.COMMENT_NOT_FOUND, '评论不存在'),
    );

    await expect(usecase.execute(999)).rejects.toThrow(DomainError);
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    commentService.hideComment.mockResolvedValue({ id: 1, isHidden: true });

    await usecase.execute(1);

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
