// src/usecases/blog/unhide-blog-comment.usecase.spec.ts

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { BlogCommentService } from '@src/modules/blog/blog-comment.service';
import { UnhideBlogCommentUsecase } from './unhide-blog-comment.usecase';

describe('UnhideBlogCommentUsecase', () => {
  let usecase: UnhideBlogCommentUsecase;
  let commentService: { unhideComment: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  beforeEach(() => {
    commentService = {
      unhideComment: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new UnhideBlogCommentUsecase(
      commentService as unknown as BlogCommentService,
      transactionRunner,
    );
  });

  it('应在事务内取消隐藏评论', async () => {
    const mockView = { id: 1, isHidden: false };
    commentService.unhideComment.mockResolvedValue(mockView);

    const result = await usecase.execute(1);

    expect(result.comment).toEqual(mockView);
    expect(commentService.unhideComment).toHaveBeenCalledWith(1, expect.anything());
  });

  it('评论不存在时应抛出 DomainError', async () => {
    commentService.unhideComment.mockRejectedValue(
      new DomainError(BLOG_ERROR.COMMENT_NOT_FOUND, '评论不存在'),
    );

    await expect(usecase.execute(999)).rejects.toThrow(DomainError);
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    commentService.unhideComment.mockResolvedValue({ id: 1, isHidden: false });

    await usecase.execute(1);

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
