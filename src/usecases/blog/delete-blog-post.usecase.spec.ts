// src/usecases/blog/delete-blog-post.usecase.spec.ts

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { BlogPostService } from '@src/modules/blog/blog-post.service';
import { BlogCommentService } from '@src/modules/blog/blog-comment.service';
import { BlogLikeService } from '@src/modules/blog/blog-like.service';
import { DeleteBlogPostUsecase } from './delete-blog-post.usecase';

describe('DeleteBlogPostUsecase', () => {
  let usecase: DeleteBlogPostUsecase;
  let postService: { softDeletePost: jest.Mock };
  let commentService: { markCommentsHiddenByPostId: jest.Mock };
  let likeService: { deleteLikesByPostId: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  beforeEach(() => {
    postService = {
      softDeletePost: jest.fn(),
    };
    commentService = {
      markCommentsHiddenByPostId: jest.fn(),
    };
    likeService = {
      deleteLikesByPostId: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new DeleteBlogPostUsecase(
      postService as unknown as BlogPostService,
      commentService as unknown as BlogCommentService,
      likeService as unknown as BlogLikeService,
      transactionRunner,
    );
  });

  it('应在事务内级联删除文章', async () => {
    const result = await usecase.execute(1);

    expect(result.deleted).toBe(true);
    expect(commentService.markCommentsHiddenByPostId).toHaveBeenCalledWith(1, expect.anything());
    expect(likeService.deleteLikesByPostId).toHaveBeenCalledWith(1, expect.anything());
    expect(postService.softDeletePost).toHaveBeenCalledWith(1, expect.anything());
  });

  it('应按顺序执行：先隐藏评论 → 清理点赞 → 软删除文章', async () => {
    const callOrder: string[] = [];
    commentService.markCommentsHiddenByPostId.mockImplementation(() => {
      callOrder.push('comment');
      return Promise.resolve();
    });
    likeService.deleteLikesByPostId.mockImplementation(() => {
      callOrder.push('like');
      return Promise.resolve();
    });
    postService.softDeletePost.mockImplementation(() => {
      callOrder.push('post');
      return Promise.resolve();
    });

    await usecase.execute(1);

    expect(callOrder).toEqual(['comment', 'like', 'post']);
  });

  it('文章不存在时应抛出 DomainError', async () => {
    postService.softDeletePost.mockRejectedValue(
      new DomainError(BLOG_ERROR.POST_NOT_FOUND, '文章不存在'),
    );

    await expect(usecase.execute(999)).rejects.toThrow(DomainError);
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    await usecase.execute(1);

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
