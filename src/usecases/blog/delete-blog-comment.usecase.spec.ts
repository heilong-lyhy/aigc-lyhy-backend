// src/usecases/blog/delete-blog-comment.usecase.spec.ts

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { BlogCommentService } from '@modules/blog/blog-comment.service';
import { BlogPostService } from '@modules/blog/blog-post.service';
import { DeleteBlogCommentUsecase } from './delete-blog-comment.usecase';

describe('DeleteBlogCommentUsecase', () => {
  let usecase: DeleteBlogCommentUsecase;
  let commentService: { softDeleteComment: jest.Mock };
  let postService: { decrementCommentCount: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  beforeEach(() => {
    commentService = {
      softDeleteComment: jest.fn(),
    };
    postService = {
      decrementCommentCount: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new DeleteBlogCommentUsecase(
      commentService as unknown as BlogCommentService,
      postService as unknown as BlogPostService,
      transactionRunner,
    );
  });

  it('应在事务内软删除评论并递减文章评论计数', async () => {
    commentService.softDeleteComment.mockResolvedValue(42);

    const result = await usecase.execute(1);

    expect(result.deleted).toBe(true);
    expect(commentService.softDeleteComment).toHaveBeenCalledWith(1, expect.anything());
    expect(postService.decrementCommentCount).toHaveBeenCalledWith(42, expect.anything());
  });

  it('评论不存在时应抛出 DomainError', async () => {
    commentService.softDeleteComment.mockRejectedValue(
      new DomainError(BLOG_ERROR.COMMENT_NOT_FOUND, '评论不存在'),
    );

    await expect(usecase.execute(999)).rejects.toThrow(DomainError);
    expect(postService.decrementCommentCount).not.toHaveBeenCalled();
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    commentService.softDeleteComment.mockResolvedValue(1);

    await usecase.execute(1);

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
