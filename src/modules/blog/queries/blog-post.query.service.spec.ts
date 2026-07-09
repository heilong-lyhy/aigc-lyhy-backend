// src/modules/blog/queries/blog-post.query.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlogPostStatus } from '@app-types/models/blog.types';
import { BlogPostEntity } from '../entities/blog-post.entity';
import { BlogPostTagEntity } from '../entities/blog-post-tag.entity';
import { BlogPostQueryService } from './blog-post.query.service';
import { BlogCategoryQueryService } from './blog-category.query.service';
import { BlogTagQueryService } from './blog-tag.query.service';
import { PaginationService } from '@modules/common/pagination.service';

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

  const mockPostTagRepo = {
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn(),
  };

  const mockCategoryQueryService = {
    findCategoryNamesByIds: jest.fn(),
  };

  const mockTagQueryService = {
    findTagsByPostId: jest.fn(),
  };

  const mockPaginationService = {
    paginateQuery: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogPostQueryService,
        { provide: getRepositoryToken(BlogPostEntity), useValue: mockPostRepo },
        { provide: getRepositoryToken(BlogPostTagEntity), useValue: mockPostTagRepo },
        { provide: BlogCategoryQueryService, useValue: mockCategoryQueryService },
        { provide: BlogTagQueryService, useValue: mockTagQueryService },
        { provide: PaginationService, useValue: mockPaginationService },
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

      // findPrevPost / findNextPost 使用 createQueryBuilder
      const mockNeighborQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockNeighborQb);

      const result = await service.findPostById(1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.title).toBe('测试文章');
      expect(result!.categoryName).toBe('技术');
      expect(result!.tags).toHaveLength(1);
      expect(result!.prevPost).toBeNull();
      expect(result!.nextPost).toBeNull();
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
      const mockNeighborQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockNeighborQb);

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

    it('文章不存在时应抛出 DomainError', async () => {
      mockPostRepo.findOne.mockResolvedValue(null);

      await expect(service.getLikeCount(999)).rejects.toThrow('文章 ID 999 不存在');
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
      const mockNeighborQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockNeighborQb);

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

  // ─── paginatePosts ───

  describe('paginatePosts', () => {
    it('应委托 PaginationService 分页并映射视图', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQb);
      mockPaginationService.paginateQuery.mockResolvedValue({
        items: [{ id: 1 }, { id: 2 }],
        total: 2,
        page: 1,
        pageSize: 10,
      });
      mockPostRepo.findBy.mockResolvedValue([mockPostEntity]);
      mockCategoryQueryService.findCategoryNamesByIds.mockResolvedValue(
        Object.fromEntries([[10, '技术']]),
      );

      const result = await service.paginatePosts({ page: 1, pageSize: 10 });

      expect(mockPostRepo.createQueryBuilder).toHaveBeenCalledWith('post');
      expect(mockQb.where).toHaveBeenCalledWith('post.deleted_at IS NULL');
      expect(mockPaginationService.paginateQuery).toHaveBeenCalled();
      expect(result.items).toBeDefined();
    });

    it('有 status 筛选时应添加条件', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQb);
      mockPaginationService.paginateQuery.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });

      await service.paginatePosts({
        page: 1,
        pageSize: 10,
        status: BlogPostStatus.PUBLISHED,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('post.status = :status', {
        status: BlogPostStatus.PUBLISHED,
      });
    });

    it('有 tagId 筛选时应添加 EXISTS 子查询', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQb);
      mockPaginationService.paginateQuery.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });

      await service.paginatePosts({
        page: 1,
        pageSize: 10,
        tagId: 3,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'EXISTS (SELECT 1 FROM blog_post_tag pt WHERE pt.post_id = post.id AND pt.tag_id = :tagId)',
        { tagId: 3 },
      );
    });
  });

  // ─── findPrevPost / findNextPost ───

  describe('findPrevPost', () => {
    it('存在时应返回相邻文章简要视图', async () => {
      const publishedAt = new Date('2024-06-01');
      const id = 3;
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 2, title: '前一篇', slug: 'prev-post' }),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findPrevPost(publishedAt, id);

      expect(result).toEqual({ id: 2, title: '前一篇', slug: 'prev-post' });
      expect(mockQb.where).toHaveBeenCalledWith('post.deleted_at IS NULL');
      expect(mockQb.andWhere).toHaveBeenCalledWith('post.status = :status', {
        status: BlogPostStatus.PUBLISHED,
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(post.published_at < :publishedAt OR (post.published_at = :publishedAt AND post.id < :id))',
        { publishedAt, id },
      );
      expect(mockQb.orderBy).toHaveBeenCalledWith('post.published_at', 'DESC');
      expect(mockQb.addOrderBy).toHaveBeenCalledWith('post.id', 'DESC');
    });

    it('不存在时应返回 null', async () => {
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findPrevPost(new Date('2024-01-01'), 1);

      expect(result).toBeNull();
    });
  });

  describe('findNextPost', () => {
    it('存在时应返回相邻文章简要视图', async () => {
      const publishedAt = new Date('2024-06-01');
      const id = 3;
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 4, title: '后一篇', slug: 'next-post' }),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findNextPost(publishedAt, id);

      expect(result).toEqual({ id: 4, title: '后一篇', slug: 'next-post' });
      expect(mockQb.where).toHaveBeenCalledWith('post.deleted_at IS NULL');
      expect(mockQb.andWhere).toHaveBeenCalledWith('post.status = :status', {
        status: BlogPostStatus.PUBLISHED,
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(post.published_at > :publishedAt OR (post.published_at = :publishedAt AND post.id > :id))',
        { publishedAt, id },
      );
      expect(mockQb.orderBy).toHaveBeenCalledWith('post.published_at', 'ASC');
      expect(mockQb.addOrderBy).toHaveBeenCalledWith('post.id', 'ASC');
    });

    it('不存在时应返回 null', async () => {
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findNextPost(new Date('2024-12-31'), 99);

      expect(result).toBeNull();
    });
  });
});
