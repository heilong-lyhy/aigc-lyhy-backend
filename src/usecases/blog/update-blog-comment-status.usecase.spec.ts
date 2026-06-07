// src/usecases/blog/update-blog-comment-status.usecase.spec.ts

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { BlogCommentStatus } from '@app-types/models/blog.types';
import { BlogCommentService } from '@src/modules/blog/blog-comment.service';
import { UpdateBlogCommentStatusUsecase } from './update-blog-comment-status.usecase';

describe('UpdateBlogCommentStatusUsecase', () => {
  let usecase: UpdateBlogCommentStatusUsecase;
  let commentService: { updateCommentStatus: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  const mockCommentView = {
    id: 1,
    postId: 1,
    parentId: null,
    replyToId: null,
    authorName: '访客',
    authorAvatar: 'https://avatar.example.com/test.png',
    content: '评论内容',
    status: BlogCommentStatus.APPROVED,
    nestingLevel: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    commentService = {
      updateCommentStatus: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new UpdateBlogCommentStatusUsecase(
      commentService as unknown as BlogCommentService,
      transactionRunner,
    );
  });

  it('应在事务内更新评论审核状态', async () => {
    commentService.updateCommentStatus.mockResolvedValue(mockCommentView);

    const result = await usecase.execute({ id: 1, status: BlogCommentStatus.APPROVED });

    expect(result.comment).toBe(mockCommentView);
    expect(result.comment.status).toBe(BlogCommentStatus.APPROVED);
    expect(commentService.updateCommentStatus).toHaveBeenCalledWith(
      { id: 1, status: BlogCommentStatus.APPROVED },
      expect.anything(),
    );
  });

  it('评论不存在时应抛出 DomainError', async () => {
    commentService.updateCommentStatus.mockRejectedValue(
      new DomainError(BLOG_ERROR.COMMENT_NOT_FOUND, '评论不存在'),
    );

    await expect(usecase.execute({ id: 999, status: BlogCommentStatus.APPROVED })).rejects.toThrow(
      DomainError,
    );
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    commentService.updateCommentStatus.mockResolvedValue(mockCommentView);

    await usecase.execute({ id: 1, status: BlogCommentStatus.APPROVED });

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
