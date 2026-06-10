// src/usecases/blog/update-blog-post.usecase.spec.ts

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { BlogPostStatus } from '@app-types/models/blog.types';
import { BlogPostService } from '@modules/blog/blog-post.service';
import { UpdateBlogPostUsecase } from './update-blog-post.usecase';

describe('UpdateBlogPostUsecase', () => {
  let usecase: UpdateBlogPostUsecase;
  let postService: {
    assertSlugUnique: jest.Mock;
    updatePostWithTags: jest.Mock;
  };
  let transactionRunner: { run: jest.Mock };

  const mockPostView = {
    id: 1,
    title: '更新后标题',
    slug: 'updated-slug',
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
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    postService = {
      assertSlugUnique: jest.fn(),
      updatePostWithTags: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new UpdateBlogPostUsecase(
      postService as unknown as BlogPostService,
      transactionRunner,
    );
  });

  it('应在事务内更新文章并返回结果', async () => {
    postService.updatePostWithTags.mockResolvedValue(mockPostView);

    const result = await usecase.execute(1, { title: '更新后标题' });

    expect(result.post).toBe(mockPostView);
    expect(postService.updatePostWithTags).toHaveBeenCalledWith(
      1,
      { title: '更新后标题' },
      expect.anything(),
    );
  });

  it('更新 slug 时应校验唯一性', async () => {
    postService.updatePostWithTags.mockResolvedValue(mockPostView);

    await usecase.execute(1, { slug: 'new-slug' });

    expect(postService.assertSlugUnique).toHaveBeenCalledWith('new-slug', 1, expect.anything());
  });

  it('不更新 slug 时不应校验唯一性', async () => {
    postService.updatePostWithTags.mockResolvedValue(mockPostView);

    await usecase.execute(1, { title: '新标题' });

    expect(postService.assertSlugUnique).not.toHaveBeenCalled();
  });

  it('slug 重复时应抛出 DomainError', async () => {
    postService.assertSlugUnique.mockRejectedValue(
      new DomainError(BLOG_ERROR.POST_SLUG_DUPLICATE, '文章 slug 已存在'),
    );

    await expect(usecase.execute(1, { slug: 'duplicate' })).rejects.toThrow(DomainError);
  });

  it('文章不存在时应抛出 DomainError', async () => {
    postService.updatePostWithTags.mockRejectedValue(
      new DomainError(BLOG_ERROR.POST_NOT_FOUND, '文章不存在'),
    );

    await expect(usecase.execute(999, { title: '不存在' })).rejects.toThrow(DomainError);
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    postService.updatePostWithTags.mockResolvedValue(mockPostView);

    await usecase.execute(1, { title: '更新' });

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
