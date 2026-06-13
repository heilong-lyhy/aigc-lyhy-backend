// src/usecases/blog/permanent-delete-blog-post.usecase.spec.ts
// 永久删除文章用例单元测试

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { BlogPostService } from '@modules/blog/blog-post.service';
import { BlogCommentService } from '@modules/blog/blog-comment.service';
import { BlogLikeService } from '@modules/blog/blog-like.service';
import { PermanentDeleteBlogPostUsecase } from './permanent-delete-blog-post.usecase';

describe('PermanentDeleteBlogPostUsecase', () => {
  let usecase: PermanentDeleteBlogPostUsecase;
  let postService: { permanentDeletePost: jest.Mock };
  let commentService: { permanentDeleteCommentsByPostId: jest.Mock };
  let likeService: { deleteLikesByPostId: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  beforeEach(() => {
    postService = { permanentDeletePost: jest.fn() };
    commentService = { permanentDeleteCommentsByPostId: jest.fn() };
    likeService = { deleteLikesByPostId: jest.fn() };
    transactionRunner = { run: jest.fn((cb) => cb({})) };

    usecase = new PermanentDeleteBlogPostUsecase(
      postService as unknown as BlogPostService,
      commentService as unknown as BlogCommentService,
      likeService as unknown as BlogLikeService,
      transactionRunner,
    );
  });

  it('应在事务内级联永久删除文章及关联数据', async () => {
    const result = await usecase.execute(1);

    expect(result.deleted).toBe(true);
    expect(commentService.permanentDeleteCommentsByPostId).toHaveBeenCalledWith(
      1,
      expect.anything(),
    );
    expect(likeService.deleteLikesByPostId).toHaveBeenCalledWith(1, expect.anything());
    expect(postService.permanentDeletePost).toHaveBeenCalledWith(1, expect.anything());
  });

  it('应按顺序执行：删除评论 → 删除点赞 → 永久删除文章', async () => {
    const callOrder: string[] = [];
    commentService.permanentDeleteCommentsByPostId.mockImplementation(() => {
      callOrder.push('comment');
      return Promise.resolve();
    });
    likeService.deleteLikesByPostId.mockImplementation(() => {
      callOrder.push('like');
      return Promise.resolve();
    });
    postService.permanentDeletePost.mockImplementation(() => {
      callOrder.push('post');
      return Promise.resolve();
    });

    await usecase.execute(1);

    expect(callOrder).toEqual(['comment', 'like', 'post']);
  });

  it('文章不存在或未被软删除时应抛出 DomainError', async () => {
    postService.permanentDeletePost.mockRejectedValue(
      new DomainError(BLOG_ERROR.POST_NOT_FOUND, '文章不存在'),
    );

    await expect(usecase.execute(999)).rejects.toThrow(DomainError);
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    await usecase.execute(1);

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
