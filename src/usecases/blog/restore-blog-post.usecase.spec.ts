// src/usecases/blog/restore-blog-post.usecase.spec.ts
// 恢复文章用例单元测试

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { BlogPostStatus } from '@app-types/models/blog.types';
import { BlogPostService } from '@modules/blog/blog-post.service';
import { BlogCommentService } from '@modules/blog/blog-comment.service';
import { RestoreBlogPostUsecase } from './restore-blog-post.usecase';

describe('RestoreBlogPostUsecase', () => {
  let usecase: RestoreBlogPostUsecase;
  let postService: { restorePost: jest.Mock };
  let commentService: { restoreCommentsByPostId: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  const mockRestoredView = {
    id: 1,
    title: '已恢复文章',
    slug: 'restored-post',
    status: BlogPostStatus.DRAFT,
    deletedAt: null,
  };

  beforeEach(() => {
    postService = { restorePost: jest.fn() };
    commentService = { restoreCommentsByPostId: jest.fn() };
    transactionRunner = { run: jest.fn((cb) => cb({})) };

    usecase = new RestoreBlogPostUsecase(
      postService as unknown as BlogPostService,
      commentService as unknown as BlogCommentService,
      transactionRunner,
    );
  });

  it('应在事务内恢复文章并级联恢复评论', async () => {
    postService.restorePost.mockResolvedValue(mockRestoredView);

    const result = await usecase.execute(1);

    expect(result.post).toBe(mockRestoredView);
    expect(commentService.restoreCommentsByPostId).toHaveBeenCalledWith(1, expect.anything());
    expect(postService.restorePost).toHaveBeenCalledWith(1, expect.anything());
  });

  it('应先恢复评论再恢复文章', async () => {
    const callOrder: string[] = [];
    commentService.restoreCommentsByPostId.mockImplementation(() => {
      callOrder.push('comment');
      return Promise.resolve();
    });
    postService.restorePost.mockImplementation(() => {
      callOrder.push('post');
      return Promise.resolve(mockRestoredView);
    });

    await usecase.execute(1);

    expect(callOrder).toEqual(['comment', 'post']);
  });

  it('文章不存在或未被软删除时应抛出 DomainError', async () => {
    postService.restorePost.mockRejectedValue(
      new DomainError(BLOG_ERROR.POST_NOT_FOUND, '文章不存在'),
    );

    await expect(usecase.execute(999)).rejects.toThrow(DomainError);
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    postService.restorePost.mockResolvedValue(mockRestoredView);

    await usecase.execute(1);

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
