// src/modules/blog/blog-post.service.spec.ts
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */

import { DomainError } from '@core/common/errors/domain-error';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogPostStatus } from '@app-types/models/blog.types';
import { BlogPostEntity } from './entities/blog-post.entity';
import { BlogPostService } from './blog-post.service';
import { BlogPostTagService } from './blog-post-tag.service';
import { BlogPostQueryService } from './queries/blog-post.query.service';

describe('BlogPostService', () => {
  let service: BlogPostService;
  let postRepo: jest.Mocked<Repository<BlogPostEntity>>;
  let queryService: { findPostById: jest.Mock };
  let postTagService: { syncPostTags: jest.Mock };

  const mockPostRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softRemove: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
  };

  const mockQueryService = {
    findPostById: jest.fn(),
  };

  const mockPostTagService = {
    syncPostTags: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogPostService,
        { provide: getRepositoryToken(BlogPostEntity), useValue: mockPostRepo },
        { provide: BlogPostQueryService, useValue: mockQueryService },
        { provide: BlogPostTagService, useValue: mockPostTagService },
      ],
    }).compile();

    service = module.get<BlogPostService>(BlogPostService);
    postRepo = module.get(getRepositoryToken(BlogPostEntity));
    queryService = mockQueryService;
    postTagService = mockPostTagService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── createPost ───

  describe('createPost', () => {
    it('应成功创建文章并委托 QueryService 返回视图', async () => {
      const input = {
        title: '测试文章',
        slug: 'test-post',
        content: '内容',
      };

      const savedEntity = {
        id: 1,
        title: input.title,
        slug: input.slug,
        content: input.content,
        excerpt: null,
        renderedContent: null,
        coverImage: null,
        status: BlogPostStatus.DRAFT,
        categoryId: null,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        isPinned: false,
        publishedAt: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BlogPostEntity;

      postRepo.create.mockReturnValue(savedEntity);
      postRepo.save.mockResolvedValue(savedEntity);
      queryService.findPostById.mockResolvedValue({
        id: 1,
        title: '测试文章',
        status: BlogPostStatus.DRAFT,
      });

      const result = await service.createPost(input);

      expect(result!.id).toBe(1);
      expect(result!.title).toBe('测试文章');
      expect(result!.status).toBe(BlogPostStatus.DRAFT);
      expect(queryService.findPostById).toHaveBeenCalledWith(1, undefined);
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
      queryService.findPostById.mockResolvedValue({
        id: 2,
        status: BlogPostStatus.PUBLISHED,
      });

      const result = await service.createPost(input);
      expect(result!.status).toBe(BlogPostStatus.PUBLISHED);
    });
  });

  // ─── createPostWithTags ───

  describe('createPostWithTags', () => {
    it('应创建文章并同步标签，返回含 tags 的完整视图', async () => {
      const input = {
        title: '带标签文章',
        slug: 'with-tags',
        content: '内容',
        tagIds: [10, 20],
      };

      const savedEntity = {
        id: 1,
        title: input.title,
        slug: input.slug,
        content: input.content,
        excerpt: null,
        renderedContent: null,
        coverImage: null,
        status: BlogPostStatus.DRAFT,
        categoryId: null,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        isPinned: false,
        publishedAt: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BlogPostEntity;

      postRepo.create.mockReturnValue(savedEntity);
      postRepo.save.mockResolvedValue(savedEntity);
      queryService.findPostById
        .mockResolvedValueOnce({ id: 1, title: '带标签文章', status: BlogPostStatus.DRAFT })
        .mockResolvedValueOnce({
          id: 1,
          title: '带标签文章',
          status: BlogPostStatus.DRAFT,
          tags: [{ id: 10 }, { id: 20 }],
        });
      postTagService.syncPostTags.mockResolvedValue(undefined);

      const result = await service.createPostWithTags(input);

      expect(postTagService.syncPostTags).toHaveBeenCalledWith(1, [10, 20], undefined);
      expect(result.tags).toHaveLength(2);
      // 标签同步后应重新读取完整 view
      expect(queryService.findPostById).toHaveBeenCalledTimes(2);
    });

    it('无 tagIds 时不应调用 syncPostTags', async () => {
      const input = {
        title: '无标签文章',
        slug: 'no-tags',
        content: '内容',
      };

      const savedEntity = {
        id: 1,
        title: input.title,
        slug: input.slug,
        content: input.content,
        excerpt: null,
        renderedContent: null,
        coverImage: null,
        status: BlogPostStatus.DRAFT,
        categoryId: null,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        isPinned: false,
        publishedAt: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BlogPostEntity;

      postRepo.create.mockReturnValue(savedEntity);
      postRepo.save.mockResolvedValue(savedEntity);
      queryService.findPostById.mockResolvedValue({ id: 1, title: '无标签文章' });

      await service.createPostWithTags(input);

      expect(postTagService.syncPostTags).not.toHaveBeenCalled();
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

      postRepo.findOne.mockResolvedValueOnce(existing);
      postRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      queryService.findPostById.mockResolvedValue({
        id: 1,
        title: '新标题',
        status: BlogPostStatus.PUBLISHED,
      });

      const result = await service.updatePost(1, {
        title: '新标题',
        status: BlogPostStatus.PUBLISHED,
      });

      expect(result!.title).toBe('新标题');
      expect(result!.status).toBe(BlogPostStatus.PUBLISHED);
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
      queryService.findPostById.mockResolvedValue({
        id: 1,
        title: '标题',
      });

      const result = await service.updatePost(1, {});

      expect(result!.title).toBe('标题');
      expect(postRepo.update).not.toHaveBeenCalled();
    });
  });

  // ─── updatePostWithTags ───

  describe('updatePostWithTags', () => {
    it('应更新文章并同步标签，返回含 tags 的完整视图', async () => {
      const existing = {
        id: 1,
        title: '旧标题',
        slug: 'old-slug',
        content: '旧内容',
        status: BlogPostStatus.DRAFT,
      } as BlogPostEntity;

      postRepo.findOne.mockResolvedValue(existing);
      postRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      queryService.findPostById
        .mockResolvedValueOnce({ id: 1, title: '新标题', status: BlogPostStatus.DRAFT })
        .mockResolvedValueOnce({
          id: 1,
          title: '新标题',
          status: BlogPostStatus.DRAFT,
          tags: [{ id: 10 }],
        });
      postTagService.syncPostTags.mockResolvedValue(undefined);

      const result = await service.updatePostWithTags(1, { tagIds: [10] });

      expect(postTagService.syncPostTags).toHaveBeenCalledWith(1, [10], undefined);
      expect(result.tags).toHaveLength(1);
    });

    it('tagIds 为 undefined 时不应调用 syncPostTags', async () => {
      const existing = {
        id: 1,
        title: '标题',
        slug: 'slug',
        content: '内容',
        status: BlogPostStatus.DRAFT,
      } as BlogPostEntity;

      postRepo.findOne.mockResolvedValue(existing);
      postRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      queryService.findPostById.mockResolvedValue({ id: 1, title: '标题' });

      await service.updatePostWithTags(1, { title: '新标题' });

      expect(postTagService.syncPostTags).not.toHaveBeenCalled();
    });
  });

  // ─── softDeletePost ───

  describe('softDeletePost', () => {
    it('应成功软删除文章并同步设置 status=DELETED', async () => {
      const existing = { id: 1, status: BlogPostStatus.DRAFT } as BlogPostEntity;
      postRepo.findOne.mockResolvedValue(existing);
      postRepo.softRemove.mockResolvedValue(existing);

      await service.softDeletePost(1);
      expect(existing.status).toBe(BlogPostStatus.DELETED);
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
      postRepo.increment.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      await service.incrementViewCount(1);
      expect(postRepo.increment).toHaveBeenCalledWith({ id: 1 }, 'viewCount', 1);
    });
  });

  describe('incrementCommentCount', () => {
    it('应调用 increment', async () => {
      postRepo.increment.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      await service.incrementCommentCount(1);
      expect(postRepo.increment).toHaveBeenCalledWith({ id: 1 }, 'commentCount', 1);
    });
  });

  describe('decrementCommentCount', () => {
    it('应调用 decrement', async () => {
      postRepo.decrement.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      await service.decrementCommentCount(1);
      expect(postRepo.decrement).toHaveBeenCalledWith({ id: 1 }, 'commentCount', 1);
    });
  });

  describe('incrementLikeCount', () => {
    it('应调用 increment', async () => {
      postRepo.increment.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      await service.incrementLikeCount(1);
      expect(postRepo.increment).toHaveBeenCalledWith({ id: 1 }, 'likeCount', 1);
    });
  });

  describe('decrementLikeCount', () => {
    it('应调用 decrement', async () => {
      postRepo.decrement.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      await service.decrementLikeCount(1);
      expect(postRepo.decrement).toHaveBeenCalledWith({ id: 1 }, 'likeCount', 1);
    });
  });

  describe('softDeletePost', () => {
    it('应重置互动计数后软删除文章', async () => {
      const entity = { id: 1, status: BlogPostStatus.DRAFT } as BlogPostEntity;
      postRepo.findOne.mockResolvedValue(entity);
      postRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      postRepo.softRemove.mockResolvedValue(entity);

      await service.softDeletePost(1);

      // 先重置计数
      expect(postRepo.update).toHaveBeenCalledWith(1, { commentCount: 0, likeCount: 0 });
      // 再软删除
      expect(entity.status).toBe(BlogPostStatus.DELETED);
      expect(postRepo.softRemove).toHaveBeenCalledWith(entity);
    });
  });

  // ─── assertSlugUnique ───

  describe('assertSlugUnique', () => {
    it('slug 不存在时应正常通过', async () => {
      postRepo.findOne.mockResolvedValue(null);

      await expect(service.assertSlugUnique('new-slug')).resolves.toBeUndefined();
    });

    it('slug 已存在且非排除 ID 时应抛出 POST_SLUG_DUPLICATE', async () => {
      postRepo.findOne.mockResolvedValue({ id: 2, slug: 'existing-slug' } as BlogPostEntity);

      await expect(service.assertSlugUnique('existing-slug')).rejects.toThrow(DomainError);
      await expect(service.assertSlugUnique('existing-slug')).rejects.toThrow('文章 slug 已存在');
    });

    it('slug 已存在但等于排除 ID 时应正常通过', async () => {
      postRepo.findOne.mockResolvedValue({ id: 1, slug: 'my-slug' } as BlogPostEntity);

      await expect(service.assertSlugUnique('my-slug', 1)).resolves.toBeUndefined();
    });
  });

  // ─── publishPost ───

  describe('publishPost', () => {
    it('应成功发布草稿文章并设置 publishedAt', async () => {
      const entity = {
        id: 1,
        status: BlogPostStatus.DRAFT,
      } as BlogPostEntity;

      postRepo.findOne.mockResolvedValue(entity);
      postRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      queryService.findPostById.mockResolvedValue({
        id: 1,
        status: BlogPostStatus.PUBLISHED,
        publishedAt: new Date(),
      });

      const result = await service.publishPost(1);

      expect(result.status).toBe(BlogPostStatus.PUBLISHED);
      expect(postRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: BlogPostStatus.PUBLISHED }),
      );
      expect(postRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ publishedAt: expect.any(Date) }),
      );
    });

    it('文章不存在时应抛出 POST_NOT_FOUND', async () => {
      postRepo.findOne.mockResolvedValue(null);

      await expect(service.publishPost(999)).rejects.toThrow(DomainError);
      await expect(service.publishPost(999)).rejects.toThrow('文章不存在');
    });

    it('文章已发布时应抛出 POST_ALREADY_PUBLISHED', async () => {
      const entity = {
        id: 1,
        status: BlogPostStatus.PUBLISHED,
      } as BlogPostEntity;

      postRepo.findOne.mockResolvedValue(entity);

      await expect(service.publishPost(1)).rejects.toThrow(DomainError);
      await expect(service.publishPost(1)).rejects.toThrow('文章已发布，无需重复发布');
    });

    it('已删除的文章不能发布', async () => {
      const entity = {
        id: 1,
        status: BlogPostStatus.DELETED,
      } as BlogPostEntity;

      postRepo.findOne.mockResolvedValue(entity);

      await expect(service.publishPost(1)).rejects.toThrow(DomainError);
      await expect(service.publishPost(1)).rejects.toThrow('已删除的文章不能发布');
    });
  });
});
