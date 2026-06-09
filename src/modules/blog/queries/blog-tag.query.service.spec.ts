// src/modules/blog/queries/blog-tag.query.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlogTagEntity } from '../entities/blog-tag.entity';
import { BlogPostTagEntity } from '../entities/blog-post-tag.entity';
import { BlogTagQueryService } from './blog-tag.query.service';

describe('BlogTagQueryService', () => {
  let service: BlogTagQueryService;

  const mockTagEntity = {
    id: 1,
    name: 'TypeScript',
    slug: 'typescript',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
  } as unknown as BlogTagEntity;

  const mockTagRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    findBy: jest.fn(),
  };

  const mockPostTagRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogTagQueryService,
        { provide: getRepositoryToken(BlogTagEntity), useValue: mockTagRepo },
        { provide: getRepositoryToken(BlogPostTagEntity), useValue: mockPostTagRepo },
      ],
    }).compile();

    service = module.get<BlogTagQueryService>(BlogTagQueryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findTagById ───

  describe('findTagById', () => {
    it('存在时应返回带 postCount 的视图', async () => {
      mockTagRepo.findOne.mockResolvedValue(mockTagEntity);
      // getPostCountsByTags 内部使用 createQueryBuilder
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ tagId: 1, count: '3' }]),
      };
      mockPostTagRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findTagById(1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.name).toBe('TypeScript');
      expect(result!.postCount).toBe(3);
      expect(mockTagRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('不存在时应返回 null', async () => {
      mockTagRepo.findOne.mockResolvedValue(null);

      const result = await service.findTagById(999);

      expect(result).toBeNull();
    });

    it('标签无文章时 postCount 应为 0', async () => {
      mockTagRepo.findOne.mockResolvedValue(mockTagEntity);
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      mockPostTagRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findTagById(1);

      expect(result).not.toBeNull();
      expect(result!.postCount).toBe(0);
    });
  });

  // ─── findTagBySlug ───

  describe('findTagBySlug', () => {
    it('存在时应返回视图', async () => {
      mockTagRepo.findOne.mockResolvedValue(mockTagEntity);
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ tagId: 1, count: '2' }]),
      };
      mockPostTagRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findTagBySlug('typescript');

      expect(result).not.toBeNull();
      expect(result!.slug).toBe('typescript');
      expect(mockTagRepo.findOne).toHaveBeenCalledWith({ where: { slug: 'typescript' } });
    });

    it('不存在时应返回 null', async () => {
      mockTagRepo.findOne.mockResolvedValue(null);

      const result = await service.findTagBySlug('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ─── listAllTags ───

  describe('listAllTags', () => {
    it('应返回所有标签视图列表', async () => {
      const tag2 = { ...mockTagEntity, id: 2, name: 'NestJS', slug: 'nestjs' };
      mockTagRepo.find.mockResolvedValue([mockTagEntity, tag2]);
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { tagId: 1, count: '3' },
          { tagId: 2, count: '1' },
        ]),
      };
      mockPostTagRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.listAllTags();

      expect(result).toHaveLength(2);
      expect(result[0].postCount).toBe(3);
      expect(result[1].postCount).toBe(1);
    });

    it('无标签时应返回空数组', async () => {
      mockTagRepo.find.mockResolvedValue([]);

      const result = await service.listAllTags();

      expect(result).toHaveLength(0);
    });
  });

  // ─── findTagsByPostId ───

  describe('findTagsByPostId', () => {
    it('文章有关联标签时应返回标签视图列表', async () => {
      mockPostTagRepo.find.mockResolvedValue([{ postId: 10, tagId: 1 }]);
      mockTagRepo.findBy.mockResolvedValue([mockTagEntity]);
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ tagId: 1, count: '5' }]),
      };
      mockPostTagRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findTagsByPostId(10);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('TypeScript');
      expect(result[0].postCount).toBe(5);
    });

    it('文章无关联标签时应返回空数组', async () => {
      mockPostTagRepo.find.mockResolvedValue([]);

      const result = await service.findTagsByPostId(10);

      expect(result).toHaveLength(0);
    });
  });
});
