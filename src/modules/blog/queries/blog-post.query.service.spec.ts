// src/modules/blog/queries/blog-post.query.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlogPostStatus } from '@app-types/models/blog.types';
import { BlogPostEntity } from '../entities/blog-post.entity';
import { BlogPostQueryService } from './blog-post.query.service';
import { BlogCategoryQueryService } from './blog-category.query.service';
import { BlogTagQueryService } from './blog-tag.query.service';

describe('BlogPostQueryService', () => {
  let service: BlogPostQueryService;

  const mockPostEntity = {
    id: 1,
    title: '测试文章',
    slug: 'test-post',
    excerpt: '摘要',
    content: '内容',
    renderedContent: '<p>内容</p>',
    coverImage: null,
    status: BlogPostStatus.PUBLISHED,
    categoryId: 10,
    viewCount: 100,
    likeCount: 5,
    commentCount: 3,
    isPinned: false,
    publishedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
  } as unknown as BlogPostEntity;

  const mockPostRepo = {
    findOne: jest.fn(),
    findBy: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockCategoryQueryService = {
    findCategoryNamesByIds: jest.fn(),
  };

  const mockTagQueryService = {
    findTagsByPostId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogPostQueryService,
        { provide: getRepositoryToken(BlogPostEntity), useValue: mockPostRepo },
        { provide: BlogCategoryQueryService, useValue: mockCategoryQueryService },
        { provide: BlogTagQueryService, useValue: mockTagQueryService },
      ],
    }).compile();

    service = module.get<BlogPostQueryService>(BlogPostQueryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findPostById ───

  describe('findPostById', () => {
    it('存在时应返回详情视图', async () => {
      mockPostRepo.findOne.mockResolvedValue(mockPostEntity);
      mockCategoryQueryService.findCategoryNamesByIds.mockResolvedValue(
        Object.fromEntries([[10, '技术']]),
      );
      mockTagQueryService.findTagsByPostId.mockResolvedValue([{ id: 1, name: 'TypeScript' }]);

      const result = await service.findPostById(1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.title).toBe('测试文章');
      expect(result!.categoryName).toBe('技术');
      expect(result!.tags).toHaveLength(1);
      expect(mockPostRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('不存在时应返回 null', async () => {
      mockPostRepo.findOne.mockResolvedValue(null);

      const result = await service.findPostById(999);

      expect(result).toBeNull();
    });

    it('无分类时 categoryName 应为 null', async () => {
      const noCategoryEntity = { ...mockPostEntity, categoryId: null };
      mockPostRepo.findOne.mockResolvedValue(noCategoryEntity);
      mockTagQueryService.findTagsByPostId.mockResolvedValue([]);

      const result = await service.findPostById(1);

      expect(result).not.toBeNull();
      expect(result!.categoryName).toBeNull();
      expect(mockCategoryQueryService.findCategoryNamesByIds).not.toHaveBeenCalled();
    });
  });

  // ─── postExists ───

  describe('postExists', () => {
    it('文章存在时应返回 true', async () => {
      mockPostRepo.count.mockResolvedValue(1);

      const result = await service.postExists(1);

      expect(result).toBe(true);
      expect(mockPostRepo.count).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('文章不存在时应返回 false', async () => {
      mockPostRepo.count.mockResolvedValue(0);

      const result = await service.postExists(999);

      expect(result).toBe(false);
    });
  });

  // ─── getLikeCount ───

  describe('getLikeCount', () => {
    it('文章存在时应返回点赞数', async () => {
      mockPostRepo.findOne.mockResolvedValue({ likeCount: 42 });

      const result = await service.getLikeCount(1);

      expect(result).toBe(42);
      expect(mockPostRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { likeCount: true },
      });
    });

    it('文章不存在时应返回 0', async () => {
      mockPostRepo.findOne.mockResolvedValue(null);

      const result = await service.getLikeCount(999);

      expect(result).toBe(0);
    });
  });

  // ─── findPostBySlug ───

  describe('findPostBySlug', () => {
    it('存在时应返回详情视图', async () => {
      mockPostRepo.findOne.mockResolvedValue(mockPostEntity);
      mockCategoryQueryService.findCategoryNamesByIds.mockResolvedValue(
        Object.fromEntries([[10, '技术']]),
      );
      mockTagQueryService.findTagsByPostId.mockResolvedValue([]);

      const result = await service.findPostBySlug('test-post');

      expect(result).not.toBeNull();
      expect(result!.slug).toBe('test-post');
      expect(mockPostRepo.findOne).toHaveBeenCalledWith({ where: { slug: 'test-post' } });
    });

    it('不存在时应返回 null', async () => {
      mockPostRepo.findOne.mockResolvedValue(null);

      const result = await service.findPostBySlug('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ─── findPostsByIdsForViewMapping ───

  describe('findPostsByIdsForViewMapping', () => {
    it('应批量查询并按输入顺序返回视图', async () => {
      const entity1 = { ...mockPostEntity, id: 1, categoryId: 10 };
      const entity2 = { ...mockPostEntity, id: 2, categoryId: 20 };
      mockPostRepo.findBy.mockResolvedValue([entity1, entity2]);
      mockCategoryQueryService.findCategoryNamesByIds.mockResolvedValue(
        Object.fromEntries([
          [10, '技术'],
          [20, '生活'],
        ]),
      );

      const result = await service.findPostsByIdsForViewMapping([1, 2]);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].categoryName).toBe('技术');
      expect(result[1].id).toBe(2);
      expect(result[1].categoryName).toBe('生活');
    });

    it('ids 为空时应返回空数组', async () => {
      const result = await service.findPostsByIdsForViewMapping([]);

      expect(result).toHaveLength(0);
      expect(mockPostRepo.findBy).not.toHaveBeenCalled();
    });

    it('部分 id 不存在时应只返回找到的视图', async () => {
      const entity1 = { ...mockPostEntity, id: 1, categoryId: null };
      mockPostRepo.findBy.mockResolvedValue([entity1]);

      const result = await service.findPostsByIdsForViewMapping([1, 999]);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('无分类的文章应传空 categoryIds 给 categoryQueryService', async () => {
      const entity = { ...mockPostEntity, id: 1, categoryId: null };
      mockPostRepo.findBy.mockResolvedValue([entity]);

      await service.findPostsByIdsForViewMapping([1]);

      // categoryIds 过滤掉 null 后为空数组，第二个参数 transactionContext 为 undefined
      expect(mockCategoryQueryService.findCategoryNamesByIds).toHaveBeenCalledWith([], undefined);
    });
  });

  // ─── createPostQueryBuilder ───

  describe('createPostQueryBuilder', () => {
    it('无筛选条件时应创建基础 QueryBuilder（含软删除过滤）', () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQb);

      const qb = service.createPostQueryBuilder({ page: 1, pageSize: 10 });

      expect(mockPostRepo.createQueryBuilder).toHaveBeenCalledWith('post');
      expect(mockQb.where).toHaveBeenCalledWith('post.deleted_at IS NULL');
      expect(qb).toBe(mockQb);
    });

    it('有 status 筛选时应添加条件', () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQb);

      service.createPostQueryBuilder({
        page: 1,
        pageSize: 10,
        status: BlogPostStatus.PUBLISHED,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('post.status = :status', {
        status: BlogPostStatus.PUBLISHED,
      });
    });

    it('有 categoryId 筛选时应添加条件', () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQb);

      service.createPostQueryBuilder({
        page: 1,
        pageSize: 10,
        categoryId: 5,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('post.category_id = :categoryId', {
        categoryId: 5,
      });
    });

    it('有 title 筛选时应添加 LIKE 条件', () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQb);

      service.createPostQueryBuilder({
        page: 1,
        pageSize: 10,
        title: '关键词',
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('post.title LIKE :title', {
        title: '%关键词%',
      });
    });

    it('有 tagId 筛选时应添加 EXISTS 子查询', () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQb);

      service.createPostQueryBuilder({
        page: 1,
        pageSize: 10,
        tagId: 3,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'EXISTS (SELECT 1 FROM blog_post_tag pt WHERE pt.post_id = post.id AND pt.tag_id = :tagId)',
        { tagId: 3 },
      );
    });

    it('categoryId + tagId 同时筛选时应添加两个条件（AND 语义）', () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQb);

      service.createPostQueryBuilder({
        page: 1,
        pageSize: 10,
        categoryId: 5,
        tagId: 3,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('post.category_id = :categoryId', {
        categoryId: 5,
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'EXISTS (SELECT 1 FROM blog_post_tag pt WHERE pt.post_id = post.id AND pt.tag_id = :tagId)',
        { tagId: 3 },
      );
    });
  });

  // ─── countPostsByCategoryIds ───

  describe('countPostsByCategoryIds', () => {
    it('应返回各分类的文章数统计', async () => {
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { categoryId: 1, count: '5' },
          { categoryId: 2, count: '3' },
        ]),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.countPostsByCategoryIds([1, 2]);

      expect(result).toEqual(
        Object.fromEntries([
          [1, 5],
          [2, 3],
        ]),
      );
    });

    it('ids 为空时应返回空对象', async () => {
      const result = await service.countPostsByCategoryIds([]);

      expect(result).toEqual({});
      expect(mockPostRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
