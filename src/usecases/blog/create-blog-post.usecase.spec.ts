// src/usecases/blog/create-blog-post.usecase.spec.ts

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { BlogPostStatus } from '@app-types/models/blog.types';
import { BlogPostService } from '@src/modules/blog/blog-post.service';
import { CreateBlogPostUsecase } from './create-blog-post.usecase';

describe('CreateBlogPostUsecase', () => {
  let usecase: CreateBlogPostUsecase;
  let postService: {
    assertSlugUnique: jest.Mock;
    createPostWithTags: jest.Mock;
  };
  let transactionRunner: { run: jest.Mock };

  const mockPostView = {
    id: 1,
    title: '测试文章',
    slug: 'test-post',
    excerpt: null,
    content: '内容',
    renderedContent: null,
    coverImage: null,
    status: BlogPostStatus.DRAFT,
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
      createPostWithTags: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new CreateBlogPostUsecase(
      postService as unknown as BlogPostService,
      transactionRunner,
    );
  });

  it('应在事务内创建文章并返回结果', async () => {
    postService.createPostWithTags.mockResolvedValue(mockPostView);

    const result = await usecase.execute({
      title: '测试文章',
      slug: 'test-post',
      content: '内容',
    });

    expect(result.post).toBe(mockPostView);
    expect(postService.assertSlugUnique).toHaveBeenCalledWith(
      'test-post',
      undefined,
      expect.anything(),
    );
    expect(postService.createPostWithTags).toHaveBeenCalledWith(
      expect.objectContaining({ title: '测试文章', slug: 'test-post', content: '内容' }),
      expect.anything(),
    );
  });

  it('slug 重复时应抛出 DomainError', async () => {
    postService.assertSlugUnique.mockRejectedValue(
      new DomainError(BLOG_ERROR.POST_SLUG_DUPLICATE, '文章 slug 已存在'),
    );

    await expect(
      usecase.execute({ title: '重复', slug: 'duplicate', content: '内容' }),
    ).rejects.toThrow(DomainError);
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    postService.createPostWithTags.mockResolvedValue(mockPostView);

    await usecase.execute({ title: '测试', slug: 'test', content: '内容' });

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });

  it('应传递 tagIds 给 createPostWithTags', async () => {
    postService.createPostWithTags.mockResolvedValue({
      ...mockPostView,
      tags: [{ id: 10 }, { id: 20 }],
    });

    const result = await usecase.execute({
      title: '带标签',
      slug: 'with-tags',
      content: '内容',
      tagIds: [10, 20],
    });

    expect(postService.createPostWithTags).toHaveBeenCalledWith(
      expect.objectContaining({ tagIds: [10, 20] }),
      expect.anything(),
    );
    expect(result.post.tags).toHaveLength(2);
  });
});
