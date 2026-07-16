// src/adapters/api/graphql/blog/blog-comment.resolver.spec.ts

import { BLOG_ERROR, DomainError } from '@core/common/errors';
import { BlogCommentStatus } from '@app-types/models/blog.types';
import { BlogCommentResolver } from './blog-comment.resolver';

const mockCommentView = {
  id: 1,
  postId: 10,
  parentId: null,
  replyToId: null,
  authorName: '访客',
  authorEmail: 'visitor@test.com',
  authorUrl: null,
  authorAvatar: null,
  content: '评论内容',
  status: BlogCommentStatus.PENDING,
  nestingLevel: 0,
  isAdminReply: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPaginatedComments = {
  items: [mockCommentView],
  page: 1,
  pageSize: 10,
  total: 1,
};

const createMockUsecases = () => ({
  listBlogCommentsUsecase: { execute: jest.fn() },
  listBlogCommentsByPostUsecase: { execute: jest.fn() },
  createBlogCommentUsecase: { execute: jest.fn() },
  createBlogCommentByUserUsecase: { execute: jest.fn() },
  replyBlogCommentUsecase: { execute: jest.fn() },
  updateBlogCommentStatusUsecase: { execute: jest.fn() },
  batchUpdateBlogCommentStatusUsecase: { execute: jest.fn() },
  deleteBlogCommentUsecase: { execute: jest.fn() },
  hideBlogCommentUsecase: { execute: jest.fn() },
  unhideBlogCommentUsecase: { execute: jest.fn() },
});

type MockUsecases = ReturnType<typeof createMockUsecases>;

describe('BlogCommentResolver', () => {
  let resolver: BlogCommentResolver;
  let mocks: MockUsecases;

  beforeEach(() => {
    mocks = createMockUsecases();
    resolver = new BlogCommentResolver(
      mocks.listBlogCommentsUsecase as any,
      mocks.listBlogCommentsByPostUsecase as any,
      mocks.createBlogCommentUsecase as any,
      mocks.createBlogCommentByUserUsecase as any,
      mocks.replyBlogCommentUsecase as any,
      mocks.updateBlogCommentStatusUsecase as any,
      mocks.batchUpdateBlogCommentStatusUsecase as any,
      mocks.deleteBlogCommentUsecase as any,
      mocks.hideBlogCommentUsecase as any,
      mocks.unhideBlogCommentUsecase as any,
    );
  });

  describe('blogCommentsByPost', () => {
    it('应查询指定文章的评论列表', async () => {
      mocks.listBlogCommentsByPostUsecase.execute.mockResolvedValue(mockPaginatedComments);

      const result = await resolver.blogCommentsByPost(10, {
        page: 1,
        limit: 10,
      });

      expect(mocks.listBlogCommentsByPostUsecase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ postId: 10 }),
      );
      expect(result.list).toHaveLength(1);
    });

    it('默认排序应为 ASC（从旧到新）', async () => {
      mocks.listBlogCommentsByPostUsecase.execute.mockResolvedValue(mockPaginatedComments);

      await resolver.blogCommentsByPost(10, {
        page: 1,
        limit: 10,
        sortOrder: undefined,
      });

      expect(mocks.listBlogCommentsByPostUsecase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: 'ASC' }),
      );
    });
  });

  describe('createBlogComment', () => {
    it('应创建评论并返回结果', async () => {
      mocks.createBlogCommentUsecase.execute.mockResolvedValue({ comment: mockCommentView });

      const result = await resolver.createBlogComment({
        postId: 10,
        authorName: '访客',
        authorEmail: 'visitor@test.com',
        content: '评论内容',
      });

      expect(mocks.createBlogCommentUsecase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          postId: 10,
          authorName: '访客',
          content: '评论内容',
        }),
      );
      expect(result).toBe(mockCommentView);
    });

    it('嵌套层级超限时应抛出 DomainError', async () => {
      mocks.createBlogCommentUsecase.execute.mockRejectedValue(
        new DomainError(BLOG_ERROR.COMMENT_NESTING_EXCEEDED, '嵌套层级超限'),
      );

      await expect(
        resolver.createBlogComment({
          postId: 10,
          parentId: 1,
          authorName: '访客',
          authorEmail: 'v@t.com',
          content: '深层回复',
        }),
      ).rejects.toThrow(DomainError);
    });
  });

  describe('updateBlogCommentStatus', () => {
    it('应更新评论状态', async () => {
      const approved = { ...mockCommentView, status: BlogCommentStatus.APPROVED };
      mocks.updateBlogCommentStatusUsecase.execute.mockResolvedValue({ comment: approved });

      const result = await resolver.updateBlogCommentStatus({
        id: 1,
        status: BlogCommentStatus.APPROVED,
      });

      expect(result.status).toBe(BlogCommentStatus.APPROVED);
    });

    it('评论不存在时应抛出 DomainError', async () => {
      mocks.updateBlogCommentStatusUsecase.execute.mockRejectedValue(
        new DomainError(BLOG_ERROR.COMMENT_NOT_FOUND, '评论不存在'),
      );

      await expect(
        resolver.updateBlogCommentStatus({ id: 999, status: BlogCommentStatus.APPROVED }),
      ).rejects.toThrow(DomainError);
    });
  });

  describe('replyBlogComment', () => {
    it('管理员回复评论应直接 APPROVED', async () => {
      const adminReply = {
        ...mockCommentView,
        isAdminReply: true,
        status: BlogCommentStatus.APPROVED,
      };
      mocks.replyBlogCommentUsecase.execute.mockResolvedValue({ comment: adminReply });

      const result = await resolver.replyBlogComment({
        postId: 10,
        content: '管理员回复',
        parentId: 1,
      });

      expect(result.isAdminReply).toBe(true);
      expect(result.status).toBe(BlogCommentStatus.APPROVED);
    });
  });

  describe('deleteBlogComment', () => {
    it('应删除评论并返回 true', async () => {
      mocks.deleteBlogCommentUsecase.execute.mockResolvedValue({ deleted: true });

      const result = await resolver.deleteBlogComment(1);

      expect(result).toBe(true);
    });

    it('评论不存在时应抛出 DomainError', async () => {
      mocks.deleteBlogCommentUsecase.execute.mockRejectedValue(
        new DomainError(BLOG_ERROR.COMMENT_NOT_FOUND, '评论不存在'),
      );

      await expect(resolver.deleteBlogComment(999)).rejects.toThrow(DomainError);
    });
  });

  describe('hideBlogComment / unhideBlogComment', () => {
    it('应隐藏评论', async () => {
      mocks.hideBlogCommentUsecase.execute.mockResolvedValue({ comment: mockCommentView });

      const result = await resolver.hideBlogComment(1);
      expect(mocks.hideBlogCommentUsecase.execute).toHaveBeenCalledWith(1);
      expect(result).toBe(mockCommentView);
    });

    it('应取消隐藏评论', async () => {
      mocks.unhideBlogCommentUsecase.execute.mockResolvedValue({ comment: mockCommentView });

      const result = await resolver.unhideBlogComment(1);
      expect(mocks.unhideBlogCommentUsecase.execute).toHaveBeenCalledWith(1);
      expect(result).toBe(mockCommentView);
    });
  });
});
