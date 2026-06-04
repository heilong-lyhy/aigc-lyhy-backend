// src/modules/blog/blog-post.service.spec.ts

import { DomainError } from '@core/common/errors/domain-error';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogPostStatus } from './blog.types';
import { BlogPostEntity } from './entities/blog-post.entity';
import { BlogPostService } from './blog-post.service';

describe('BlogPostService', () => {
  let service: BlogPostService;
  let postRepo: jest.Mocked<Repository<BlogPostEntity>>;

  const mockPostRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softRemove: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogPostService,
        { provide: getRepositoryToken(BlogPostEntity), useValue: mockPostRepo },
      ],
    }).compile();

    service = module.get<BlogPostService>(BlogPostService);
    postRepo = module.get(getRepositoryToken(BlogPostEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── createPost ───

  describe('createPost', () => {
    it('应成功创建文章并返回 WriteResult', async () => {
      const input = {
        title: '测试文章',
        slug: 'test-post',
        content: '内容',
      };

      const savedEntity = {
        id: 1,
        ...input,
        excerpt: null,
        coverImage: null,
        status: BlogPostStatus.DRAFT,
        categoryId: null,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        isPinned: false,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BlogPostEntity;

      postRepo.create.mockReturnValue(savedEntity);
      postRepo.save.mockResolvedValue(savedEntity);

      const result = await service.createPost(input);

      expect(result.id).toBe(1);
      expect(result.title).toBe('测试文章');
      expect(result.status).toBe(BlogPostStatus.DRAFT);
      // WriteResult 不含 categoryName
      expect(result).not.toHaveProperty('categoryName');
    });

    it('应使用传入的 status 覆盖默认 DRAFT', async () => {
      const input = {
        title: '直接发布',
        slug: 'direct-publish',
        content: '内容',
        status: BlogPostStatus.PUBLISHED,
      };

      const savedEntity = {
        id: 2,
        ...input,
        excerpt: null,
        coverImage: null,
        categoryId: null,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        isPinned: false,
        publishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BlogPostEntity;

      postRepo.create.mockReturnValue(savedEntity);
      postRepo.save.mockResolvedValue(savedEntity);

      const result = await service.createPost(input);
      expect(result.status).toBe(BlogPostStatus.PUBLISHED);
    });
  });

  // ─── updatePost ───

  describe('updatePost', () => {
    it('应成功更新文章字段', async () => {
      const existing = {
        id: 1,
        title: '旧标题',
        slug: 'old-slug',
        content: '旧内容',
        status: BlogPostStatus.DRAFT,
      } as BlogPostEntity;

      const updated = {
        ...existing,
        title: '新标题',
        status: BlogPostStatus.PUBLISHED,
      } as BlogPostEntity;

      postRepo.findOne.mockResolvedValueOnce(existing);
      postRepo.update.mockResolvedValue(undefined);
      postRepo.findOne.mockResolvedValueOnce(updated);

      const result = await service.updatePost(1, {
        title: '新标题',
        status: BlogPostStatus.PUBLISHED,
      });

      expect(result.title).toBe('新标题');
      expect(result.status).toBe(BlogPostStatus.PUBLISHED);
      expect(postRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ title: '新标题' }));
    });

    it('文章不存在时应抛出 POST_NOT_FOUND', async () => {
      postRepo.findOne.mockResolvedValue(null);

      await expect(service.updatePost(999, { title: '不存在' })).rejects.toThrow(DomainError);
      await expect(service.updatePost(999, { title: '不存在' })).rejects.toThrow('文章不存在');
    });

    it('无字段变更时应直接返回当前视图', async () => {
      const existing = {
        id: 1,
        title: '标题',
        slug: 'slug',
        content: '内容',
        status: BlogPostStatus.DRAFT,
      } as BlogPostEntity;

      postRepo.findOne.mockResolvedValue(existing);

      const result = await service.updatePost(1, {});

      expect(result.title).toBe('标题');
      expect(postRepo.update).not.toHaveBeenCalled();
    });
  });

  // ─── softDeletePost ───

  describe('softDeletePost', () => {
    it('应成功软删除文章', async () => {
      const existing = { id: 1 } as BlogPostEntity;
      postRepo.findOne.mockResolvedValue(existing);
      postRepo.softRemove.mockResolvedValue(existing);

      await service.softDeletePost(1);
      expect(postRepo.softRemove).toHaveBeenCalledWith(existing);
    });

    it('文章不存在时应抛出 POST_NOT_FOUND', async () => {
      postRepo.findOne.mockResolvedValue(null);

      await expect(service.softDeletePost(999)).rejects.toThrow(DomainError);
      await expect(service.softDeletePost(999)).rejects.toThrow('文章不存在');
    });
  });

  // ─── incrementViewCount / incrementCommentCount / decrementCommentCount ───

  describe('incrementViewCount', () => {
    it('应调用 increment', async () => {
      postRepo.increment.mockResolvedValue(undefined);
      await service.incrementViewCount(1);
      expect(postRepo.increment).toHaveBeenCalledWith({ id: 1 }, 'viewCount', 1);
    });
  });

  describe('incrementCommentCount', () => {
    it('应调用 increment', async () => {
      postRepo.increment.mockResolvedValue(undefined);
      await service.incrementCommentCount(1);
      expect(postRepo.increment).toHaveBeenCalledWith({ id: 1 }, 'commentCount', 1);
    });
  });

  describe('decrementCommentCount', () => {
    it('应调用 decrement', async () => {
      postRepo.decrement.mockResolvedValue(undefined);
      await service.decrementCommentCount(1);
      expect(postRepo.decrement).toHaveBeenCalledWith({ id: 1 }, 'commentCount', 1);
    });
  });
});
