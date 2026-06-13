// src/usecases/blog/view-blog-post.usecase.spec.ts
// 公开端浏览文章用例单元测试：验证读取 + 阅读量自增编排

import { BlogPostStatus } from '@app-types/models/blog.types';
import { ViewBlogPostUsecase } from './view-blog-post.usecase';
import { BlogPostQueryService } from '@modules/blog/queries/blog-post.query.service';
import { BlogPostService } from '@modules/blog/blog-post.service';

describe('ViewBlogPostUsecase', () => {
  let usecase: ViewBlogPostUsecase;
  let postQueryService: { findPostById: jest.Mock; findPostBySlug: jest.Mock };
  let postService: { incrementViewCount: jest.Mock };

  beforeEach(() => {
    postQueryService = {
      findPostById: jest.fn(),
      findPostBySlug: jest.fn(),
    };
    postService = { incrementViewCount: jest.fn().mockResolvedValue(undefined) };
    usecase = new ViewBlogPostUsecase(
      postQueryService as unknown as BlogPostQueryService,
      postService as unknown as BlogPostService,
    );
  });

  // ─── viewById ───

  describe('viewById', () => {
    it('已发布文章应返回详情并自增阅读量', async () => {
      const view = { id: 1, title: '文章', status: BlogPostStatus.PUBLISHED };
      postQueryService.findPostById.mockResolvedValue(view);

      const result = await usecase.viewById(1);

      expect(result).toEqual(view);
      expect(postService.incrementViewCount).toHaveBeenCalledWith(1);
    });

    it('文章不存在时应返回 null 且不自增阅读量', async () => {
      postQueryService.findPostById.mockResolvedValue(null);

      const result = await usecase.viewById(999);

      expect(result).toBeNull();
      expect(postService.incrementViewCount).not.toHaveBeenCalled();
    });

    it('非发布文章应返回 null 且不自增阅读量', async () => {
      const view = { id: 1, title: '草稿', status: BlogPostStatus.DRAFT };
      postQueryService.findPostById.mockResolvedValue(view);

      const result = await usecase.viewById(1);

      expect(result).toBeNull();
      expect(postService.incrementViewCount).not.toHaveBeenCalled();
    });

    it('阅读量自增失败不应影响详情返回', async () => {
      const view = { id: 1, title: '文章', status: BlogPostStatus.PUBLISHED };
      postQueryService.findPostById.mockResolvedValue(view);
      postService.incrementViewCount.mockRejectedValue(new Error('DB error'));

      const result = await usecase.viewById(1);

      expect(result).toEqual(view);
    });
  });

  // ─── viewBySlug ───

  describe('viewBySlug', () => {
    it('已发布文章应返回详情并自增阅读量', async () => {
      const view = { id: 1, slug: 'test-post', status: BlogPostStatus.PUBLISHED };
      postQueryService.findPostBySlug.mockResolvedValue(view);

      const result = await usecase.viewBySlug('test-post');

      expect(result).toEqual(view);
      expect(postService.incrementViewCount).toHaveBeenCalledWith(1);
    });

    it('slug 不存在时应返回 null 且不自增阅读量', async () => {
      postQueryService.findPostBySlug.mockResolvedValue(null);

      const result = await usecase.viewBySlug('nonexistent');

      expect(result).toBeNull();
      expect(postService.incrementViewCount).not.toHaveBeenCalled();
    });

    it('非发布文章应返回 null 且不自增阅读量', async () => {
      const view = { id: 1, slug: 'draft', status: BlogPostStatus.DRAFT };
      postQueryService.findPostBySlug.mockResolvedValue(view);

      const result = await usecase.viewBySlug('draft');

      expect(result).toBeNull();
      expect(postService.incrementViewCount).not.toHaveBeenCalled();
    });

    it('阅读量自增失败不应影响详情返回', async () => {
      const view = { id: 1, slug: 'test-post', status: BlogPostStatus.PUBLISHED };
      postQueryService.findPostBySlug.mockResolvedValue(view);
      postService.incrementViewCount.mockRejectedValue(new Error('DB error'));

      const result = await usecase.viewBySlug('test-post');

      expect(result).toEqual(view);
    });
  });
});
