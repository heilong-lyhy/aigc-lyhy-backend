// src/adapters/api/graphql/blog/blog-post.resolver.spec.ts

import { BLOG_ERROR, DomainError } from '@core/common/errors';
import { BlogPostStatus } from '@app-types/models/blog.types';
import { BlogPostResolver } from './blog-post.resolver';

// ─── Mock factories ───

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

const mockPaginatedResult = {
  items: [mockPostView],
  page: 1,
  pageSize: 10,
  total: 1,
};

const createMockUsecases = () => ({
  viewBlogPostUsecase: {
    viewById: jest.fn(),
    viewBySlug: jest.fn(),
  },
  listBlogPostsUsecase: { execute: jest.fn() },
  listBlogPublishedPostsUsecase: { execute: jest.fn() },
  createBlogPostUsecase: { execute: jest.fn() },
  updateBlogPostUsecase: { execute: jest.fn() },
  deleteBlogPostUsecase: { execute: jest.fn() },
  publishBlogPostUsecase: { execute: jest.fn() },
  restoreBlogPostUsecase: { execute: jest.fn() },
  permanentDeleteBlogPostUsecase: { execute: jest.fn() },
  listDeletedBlogPostsUsecase: { execute: jest.fn() },
});

type MockUsecases = ReturnType<typeof createMockUsecases>;

describe('BlogPostResolver', () => {
  let resolver: BlogPostResolver;
  let mocks: MockUsecases;

  beforeEach(() => {
    mocks = createMockUsecases();
    resolver = new BlogPostResolver(
      mocks.viewBlogPostUsecase as any,
      mocks.listBlogPostsUsecase as any,
      mocks.listBlogPublishedPostsUsecase as any,
      mocks.createBlogPostUsecase as any,
      mocks.updateBlogPostUsecase as any,
      mocks.deleteBlogPostUsecase as any,
      mocks.publishBlogPostUsecase as any,
      mocks.restoreBlogPostUsecase as any,
      mocks.permanentDeleteBlogPostUsecase as any,
      mocks.listDeletedBlogPostsUsecase as any,
    );
  });

  // ─── 公开查询 ───

  describe('blogPost', () => {
    it('应通过 ID 查询文章详情', async () => {
      mocks.viewBlogPostUsecase.viewById.mockResolvedValue(mockPostView);

      const result = await resolver.blogPost({ id: 1 });

      expect(mocks.viewBlogPostUsecase.viewById).toHaveBeenCalledWith(1);
      expect(result).toBe(mockPostView);
    });

    it('文章不存在时应返回 null', async () => {
      mocks.viewBlogPostUsecase.viewById.mockResolvedValue(null);

      const result = await resolver.blogPost({ id: 999 });

      expect(result).toBeNull();
    });
  });

  describe('blogPostBySlug', () => {
    it('应通过 slug 查询文章详情', async () => {
      mocks.viewBlogPostUsecase.viewBySlug.mockResolvedValue(mockPostView);

      const result = await resolver.blogPostBySlug('test-post');

      expect(mocks.viewBlogPostUsecase.viewBySlug).toHaveBeenCalledWith('test-post');
      expect(result).toBe(mockPostView);
    });

    it('slug 不存在时应返回 null', async () => {
      mocks.viewBlogPostUsecase.viewBySlug.mockResolvedValue(null);

      const result = await resolver.blogPostBySlug('not-exist');

      expect(result).toBeNull();
    });
  });

  describe('blogPublishedPosts', () => {
    it('应查询已发布文章列表', async () => {
      mocks.listBlogPublishedPostsUsecase.execute.mockResolvedValue(mockPaginatedResult);

      const result = await resolver.blogPublishedPosts({
        page: 1,
        limit: 10,
        sortBy: undefined,
        sortOrder: undefined,
        categoryId: undefined,
        title: undefined,
        tagId: undefined,
      });

      expect(result.list).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ─── 管理端 Mutation ───

  describe('createBlogPost', () => {
    it('应创建文章并返回结果', async () => {
      mocks.createBlogPostUsecase.execute.mockResolvedValue({ post: mockPostView });

      const result = await resolver.createBlogPost({
        title: '测试文章',
        slug: 'test-post',
        content: '内容',
      });

      expect(mocks.createBlogPostUsecase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '测试文章',
          slug: 'test-post',
          content: '内容',
        }),
      );
      expect(result).toBe(mockPostView);
    });

    it('slug 重复时应抛出 DomainError', async () => {
      mocks.createBlogPostUsecase.execute.mockRejectedValue(
        new DomainError(BLOG_ERROR.POST_SLUG_DUPLICATE, 'slug 已存在'),
      );

      await expect(
        resolver.createBlogPost({ title: '测试', slug: 'dup', content: '内容' }),
      ).rejects.toThrow(DomainError);
    });
  });

  describe('updateBlogPost', () => {
    it('应更新文章并返回结果', async () => {
      mocks.updateBlogPostUsecase.execute.mockResolvedValue({
        post: { ...mockPostView, title: '新标题' },
      });

      const result = await resolver.updateBlogPost({ id: 1, title: '新标题' });

      expect(mocks.updateBlogPostUsecase.execute).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ title: '新标题' }),
      );
      expect(result.title).toBe('新标题');
    });

    it('文章不存在时应抛出 DomainError', async () => {
      mocks.updateBlogPostUsecase.execute.mockRejectedValue(
        new DomainError(BLOG_ERROR.POST_NOT_FOUND, '文章不存在'),
      );

      await expect(resolver.updateBlogPost({ id: 999, title: '不存在' })).rejects.toThrow(
        DomainError,
      );
    });
  });

  describe('deleteBlogPost', () => {
    it('应删除文章并返回 true', async () => {
      mocks.deleteBlogPostUsecase.execute.mockResolvedValue({ deleted: true });

      const result = await resolver.deleteBlogPost(1);

      expect(mocks.deleteBlogPostUsecase.execute).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('文章不存在时应抛出 DomainError', async () => {
      mocks.deleteBlogPostUsecase.execute.mockRejectedValue(
        new DomainError(BLOG_ERROR.POST_NOT_FOUND, '文章不存在'),
      );

      await expect(resolver.deleteBlogPost(999)).rejects.toThrow(DomainError);
    });
  });

  describe('publishBlogPost', () => {
    it('应发布文章', async () => {
      const published = { ...mockPostView, status: BlogPostStatus.PUBLISHED };
      mocks.publishBlogPostUsecase.execute.mockResolvedValue({ post: published });

      const result = await resolver.publishBlogPost(1);

      expect(mocks.publishBlogPostUsecase.execute).toHaveBeenCalledWith(1);
      expect(result.status).toBe(BlogPostStatus.PUBLISHED);
    });

    it('文章已发布时应抛出 DomainError', async () => {
      mocks.publishBlogPostUsecase.execute.mockRejectedValue(
        new DomainError(BLOG_ERROR.POST_ALREADY_PUBLISHED, '已发布'),
      );

      await expect(resolver.publishBlogPost(1)).rejects.toThrow(DomainError);
    });
  });

  // ─── 回收站 ───

  describe('restoreBlogPost', () => {
    it('应恢复已删除文章', async () => {
      mocks.restoreBlogPostUsecase.execute.mockResolvedValue({ post: mockPostView });

      const result = await resolver.restoreBlogPost(1);

      expect(mocks.restoreBlogPostUsecase.execute).toHaveBeenCalledWith(1);
      expect(result).toBe(mockPostView);
    });

    it('文章未删除时应抛出 DomainError', async () => {
      mocks.restoreBlogPostUsecase.execute.mockRejectedValue(
        new DomainError(BLOG_ERROR.POST_NOT_DELETED, '文章未删除'),
      );

      await expect(resolver.restoreBlogPost(1)).rejects.toThrow(DomainError);
    });
  });

  describe('permanentDeleteBlogPost', () => {
    it('应永久删除文章并返回 true', async () => {
      mocks.permanentDeleteBlogPostUsecase.execute.mockResolvedValue({ deleted: true });

      const result = await resolver.permanentDeleteBlogPost(1);

      expect(result).toBe(true);
    });

    it('文章不存在时应抛出 DomainError', async () => {
      mocks.permanentDeleteBlogPostUsecase.execute.mockRejectedValue(
        new DomainError(BLOG_ERROR.POST_NOT_FOUND, '文章不存在'),
      );

      await expect(resolver.permanentDeleteBlogPost(999)).rejects.toThrow(DomainError);
    });
  });
});
