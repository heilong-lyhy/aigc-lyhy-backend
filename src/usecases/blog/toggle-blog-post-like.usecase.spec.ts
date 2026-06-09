// src/usecases/blog/toggle-blog-post-like.usecase.spec.ts

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { BlogLikeService } from '@src/modules/blog/blog-like.service';
import { BlogPostService } from '@src/modules/blog/blog-post.service';
import { BlogPostQueryService } from '@src/modules/blog/queries/blog-post.query.service';
import { ToggleBlogPostLikeUsecase } from './toggle-blog-post-like.usecase';

describe('ToggleBlogPostLikeUsecase', () => {
  let usecase: ToggleBlogPostLikeUsecase;
  let likeService: { toggleLike: jest.Mock };
  let postService: {
    incrementLikeCount: jest.Mock;
    decrementLikeCount: jest.Mock;
  };
  let postQueryService: { getLikeCount: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  beforeEach(() => {
    likeService = {
      toggleLike: jest.fn(),
    };
    postService = {
      incrementLikeCount: jest.fn(),
      decrementLikeCount: jest.fn(),
    };
    postQueryService = {
      getLikeCount: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new ToggleBlogPostLikeUsecase(
      likeService as unknown as BlogLikeService,
      postService as unknown as BlogPostService,
      postQueryService as unknown as BlogPostQueryService,
      transactionRunner,
    );
  });

  it('点赞时应返回 liked=true 并递增 likeCount', async () => {
    likeService.toggleLike.mockResolvedValue({ liked: true });
    postQueryService.getLikeCount.mockResolvedValue(1);

    const result = await usecase.execute(1, 'user:1');

    expect(result.liked).toBe(true);
    expect(result.likeCount).toBe(1);
    expect(postService.incrementLikeCount).toHaveBeenCalledWith(1, expect.anything());
    expect(postService.decrementLikeCount).not.toHaveBeenCalled();
  });

  it('取消点赞时应返回 liked=false 并递减 likeCount', async () => {
    likeService.toggleLike.mockResolvedValue({ liked: false });
    postQueryService.getLikeCount.mockResolvedValue(0);

    const result = await usecase.execute(1, 'user:1');

    expect(result.liked).toBe(false);
    expect(result.likeCount).toBe(0);
    expect(postService.decrementLikeCount).toHaveBeenCalledWith(1, expect.anything());
    expect(postService.incrementLikeCount).not.toHaveBeenCalled();
  });

  it('文章不存在时应抛出 DomainError', async () => {
    likeService.toggleLike.mockRejectedValue(
      new DomainError(BLOG_ERROR.POST_NOT_FOUND, '文章不存在'),
    );

    await expect(usecase.execute(999, 'user:1')).rejects.toThrow(DomainError);
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    likeService.toggleLike.mockResolvedValue({ liked: true });
    postQueryService.getLikeCount.mockResolvedValue(1);

    await usecase.execute(1, 'user:1');

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
