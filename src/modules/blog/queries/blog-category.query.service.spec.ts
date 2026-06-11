// src/modules/blog/queries/blog-category.query.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogCategoryEntity } from '../entities/blog-category.entity';
import { BlogPostEntity } from '../entities/blog-post.entity';
import { BlogCategoryQueryService } from './blog-category.query.service';

/** 构造 id→count 映射，避免 ESLint 对数字键报错 */
const buildCountMap = (entries: ReadonlyArray<readonly [number, number]>): Record<number, number> =>
  Object.fromEntries(entries);

/** 构造 id→name 映射，避免 ESLint 对数字键报错 */
const buildNameMap = (entries: ReadonlyArray<readonly [number, string]>): Record<number, string> =>
  Object.fromEntries(entries);

describe('BlogCategoryQueryService', () => {
  let service: BlogCategoryQueryService;
  let categoryRepo: jest.Mocked<Repository<BlogCategoryEntity>>;

  const mockCategoryRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    findBy: jest.fn(),
  };

  const mockPostRepo = {
    createQueryBuilder: jest.fn(),
  };

  /** 构造 countPostsByCategoryIds 的 mock QueryBuilder，返回指定映射 */
  const mockCountQb = (countMap: Record<number, number>) => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(
      Object.entries(countMap).map(([categoryId, count]) => ({
        categoryId: Number(categoryId),
        count: String(count),
      })),
    ),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogCategoryQueryService,
        { provide: getRepositoryToken(BlogCategoryEntity), useValue: mockCategoryRepo },
        { provide: getRepositoryToken(BlogPostEntity), useValue: mockPostRepo },
      ],
    }).compile();

    service = module.get<BlogCategoryQueryService>(BlogCategoryQueryService);
    categoryRepo = module.get(getRepositoryToken(BlogCategoryEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findCategoryById ───

  describe('findCategoryById', () => {
    it('分类不存在时应返回 null', async () => {
      categoryRepo.findOne.mockResolvedValue(null);

      const result = await service.findCategoryById(999);

      expect(result).toBeNull();
    });

    it('应返回包含 postCount 的视图', async () => {
      const entity = {
        id: 1,
        name: '技术',
        slug: 'tech',
        description: null,
        parentId: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BlogCategoryEntity;

      categoryRepo.findOne.mockResolvedValue(entity);
      mockPostRepo.createQueryBuilder.mockReturnValue(mockCountQb(buildCountMap([[1, 5]])));

      const result = await service.findCategoryById(1);

      expect(result).not.toBeNull();
      expect(result!.postCount).toBe(5);
      expect(result!.name).toBe('技术');
    });
  });

  // ─── findCategoryNamesByIds ───

  describe('findCategoryNamesByIds', () => {
    it('ids 为空时应返回空对象', async () => {
      const result = await service.findCategoryNamesByIds([]);

      expect(result).toEqual({});
      expect(categoryRepo.findBy).not.toHaveBeenCalled();
    });

    it('应返回 id→name 映射', async () => {
      const categories = [
        { id: 1, name: '技术' },
        { id: 2, name: '生活' },
      ] as BlogCategoryEntity[];

      categoryRepo.findBy.mockResolvedValue(categories);

      const result = await service.findCategoryNamesByIds([1, 2]);

      expect(result).toEqual(
        buildNameMap([
          [1, '技术'],
          [2, '生活'],
        ]),
      );
    });

    it('部分 id 不存在时应只返回存在的映射', async () => {
      const categories = [{ id: 1, name: '技术' }] as BlogCategoryEntity[];

      categoryRepo.findBy.mockResolvedValue(categories);

      const result = await service.findCategoryNamesByIds([1, 999]);

      expect(result).toEqual(buildNameMap([[1, '技术']]));
      expect(result).not.toHaveProperty('999');
    });
  });

  // ─── getCategoryTree ───

  describe('getCategoryTree', () => {
    it('应正确构建分类树', async () => {
      const entities = [
        { id: 1, name: '根分类', slug: 'root', parentId: null, sortOrder: 0 },
        { id: 2, name: '子分类A', slug: 'sub-a', parentId: 1, sortOrder: 1 },
        { id: 3, name: '子分类B', slug: 'sub-b', parentId: 1, sortOrder: 2 },
        { id: 4, name: '孙分类', slug: 'grandchild', parentId: 2, sortOrder: 0 },
      ] as BlogCategoryEntity[];

      categoryRepo.find.mockResolvedValue(entities);
      mockPostRepo.createQueryBuilder.mockReturnValue(
        mockCountQb(
          buildCountMap([
            [1, 10],
            [2, 5],
            [3, 3],
            [4, 1],
          ]),
        ),
      );

      const result = await service.getCategoryTree();

      // 应有 1 个根节点
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('根分类');
      expect(result[0].children).toHaveLength(2);
      expect(result[0].children[0].name).toBe('子分类A');
      expect(result[0].children[0].children).toHaveLength(1);
      expect(result[0].children[0].children[0].name).toBe('孙分类');
    });

    it('无分类时应返回空数组', async () => {
      categoryRepo.find.mockResolvedValue([]);

      const result = await service.getCategoryTree();

      expect(result).toEqual([]);
    });

    it('parentId 指向不存在的分类时应作为根节点', async () => {
      const entities = [
        { id: 1, name: '孤立分类', slug: 'orphan', parentId: 999, sortOrder: 0 },
      ] as BlogCategoryEntity[];

      categoryRepo.find.mockResolvedValue(entities);
      mockPostRepo.createQueryBuilder.mockReturnValue(mockCountQb(buildCountMap([[1, 0]])));

      const result = await service.getCategoryTree();

      // parentId=999 不在 map 中，应作为根节点
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('孤立分类');
    });
  });

  // ─── countPostsByCategoryIds ───

  describe('countPostsByCategoryIds', () => {
    it('应返回各分类的文章数统计', async () => {
      mockPostRepo.createQueryBuilder.mockReturnValue(
        mockCountQb(
          buildCountMap([
            [1, 5],
            [2, 3],
          ]),
        ),
      );

      const result = await service.countPostsByCategoryIds([1, 2]);

      expect(result).toEqual(
        buildCountMap([
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
