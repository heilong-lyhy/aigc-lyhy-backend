// src/usecases/blog/publish-blog-post.usecase.spec.ts

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { BlogPostStatus } from '@app-types/models/blog.types';
import { BlogPostService } from '@src/modules/blog/blog-post.service';
import { PublishBlogPostUsecase } from './publish-blog-post.usecase';

describe('PublishBlogPostUsecase', () => {
  let usecase: PublishBlogPostUsecase;
  let postService: { publishPost: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  const mockPublishedView = {
    id: 1,
    title: '已发布文章',
    slug: 'published-post',
    excerpt: null,
    content: '内容',
    renderedContent: null,
    coverImage: null,
    status: BlogPostStatus.PUBLISHED,
    categoryId: null,
    categoryName: null,
    tags: [],
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    isPinned: false,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    postService = {
      publishPost: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new PublishBlogPostUsecase(
      postService as unknown as BlogPostService,
      transactionRunner,
    );
  });

  it('应在事务内发布文章并返回结果', async () => {
    postService.publishPost.mockResolvedValue(mockPublishedView);

    const result = await usecase.execute(1);

    expect(result.post).toBe(mockPublishedView);
    expect(result.post.status).toBe(BlogPostStatus.PUBLISHED);
    expect(postService.publishPost).toHaveBeenCalledWith(1, expect.anything());
  });

  it('文章不存在时应抛出 DomainError', async () => {
    postService.publishPost.mockRejectedValue(
      new DomainError(BLOG_ERROR.POST_NOT_FOUND, '文章不存在'),
    );

    await expect(usecase.execute(999)).rejects.toThrow(DomainError);
  });

  it('文章已发布时应抛出 DomainError', async () => {
    postService.publishPost.mockRejectedValue(
      new DomainError(BLOG_ERROR.POST_ALREADY_PUBLISHED, '文章已发布，无需重复发布'),
    );

    await expect(usecase.execute(1)).rejects.toThrow(DomainError);
  });

  it('已删除的文章不能发布', async () => {
    postService.publishPost.mockRejectedValue(
      new DomainError(BLOG_ERROR.POST_DELETED, '已删除的文章不能发布'),
    );

    await expect(usecase.execute(1)).rejects.toThrow(DomainError);
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    postService.publishPost.mockResolvedValue(mockPublishedView);

    await usecase.execute(1);

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
