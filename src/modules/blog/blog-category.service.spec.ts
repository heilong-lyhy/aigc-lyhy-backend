// src/modules/blog/blog-category.service.spec.ts

import { DomainError } from '@core/common/errors/domain-error';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogCategoryEntity } from './entities/blog-category.entity';
import { BlogCategoryService } from './blog-category.service';
import { BlogCategoryQueryService } from './queries/blog-category.query.service';

describe('BlogCategoryService', () => {
  let service: BlogCategoryService;
  let categoryRepo: jest.Mocked<Repository<BlogCategoryEntity>>;
  let queryService: { findCategoryById: jest.Mock };

  const mockCategoryRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softRemove: jest.fn(),
  };

  const mockQueryService = {
    findCategoryById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogCategoryService,
        { provide: getRepositoryToken(BlogCategoryEntity), useValue: mockCategoryRepo },
        { provide: BlogCategoryQueryService, useValue: mockQueryService },
      ],
    }).compile();

    service = module.get<BlogCategoryService>(BlogCategoryService);
    categoryRepo = module.get(getRepositoryToken(BlogCategoryEntity));
    queryService = mockQueryService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── createCategory ───

  describe('createCategory', () => {
    it('应成功创建分类并委托 QueryService 返回视图', async () => {
      const input = { name: '技术', slug: 'tech' };

      const savedEntity = {
        id: 1,
        name: '技术',
        slug: 'tech',
        description: null,
        parentId: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BlogCategoryEntity;

      categoryRepo.create.mockReturnValue(savedEntity);
      categoryRepo.save.mockResolvedValue(savedEntity);
      queryService.findCategoryById.mockResolvedValue({
        id: 1,
        name: '技术',
        postCount: 0,
      });

      const result = await service.createCategory(input);

      expect(result.id).toBe(1);
      expect(result.name).toBe('技术');
      expect(queryService.findCategoryById).toHaveBeenCalledWith(1, undefined);
    });

    it('应使用传入的 parentId 和 sortOrder', async () => {
      const input = { name: '子分类', slug: 'sub', parentId: 1, sortOrder: 10 };

      const savedEntity = {
        id: 2,
        ...input,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BlogCategoryEntity;

      categoryRepo.create.mockReturnValue(savedEntity);
      categoryRepo.save.mockResolvedValue(savedEntity);
      queryService.findCategoryById.mockResolvedValue({
        id: 2,
        parentId: 1,
        sortOrder: 10,
      });

      const result = await service.createCategory(input);
      expect(result.parentId).toBe(1);
      expect(result.sortOrder).toBe(10);
    });
  });

  // ─── updateCategory ───

  describe('updateCategory', () => {
    it('应成功更新分类字段', async () => {
      const existing = {
        id: 1,
        name: '旧名称',
        slug: 'old-slug',
        description: null,
        parentId: null,
        sortOrder: 0,
      } as BlogCategoryEntity;

      categoryRepo.findOne.mockResolvedValueOnce(existing);
      categoryRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      queryService.findCategoryById.mockResolvedValue({
        id: 1,
        name: '新名称',
      });

      const result = await service.updateCategory(1, { name: '新名称' });

      expect(result.name).toBe('新名称');
      expect(categoryRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: '新名称' }),
      );
    });

    it('分类不存在时应抛出 CATEGORY_NOT_FOUND', async () => {
      categoryRepo.findOne.mockResolvedValue(null);

      await expect(service.updateCategory(999, { name: '不存在' })).rejects.toThrow(DomainError);
      await expect(service.updateCategory(999, { name: '不存在' })).rejects.toThrow('分类不存在');
    });

    it('无字段变更时应直接返回当前视图', async () => {
      const existing = {
        id: 1,
        name: '名称',
        slug: 'slug',
        description: null,
        parentId: null,
        sortOrder: 0,
      } as BlogCategoryEntity;

      categoryRepo.findOne.mockResolvedValue(existing);
      queryService.findCategoryById.mockResolvedValue({
        id: 1,
        name: '名称',
      });

      const result = await service.updateCategory(1, {});

      expect(result.name).toBe('名称');
      expect(categoryRepo.update).not.toHaveBeenCalled();
    });
  });

  // ─── softDeleteCategory ───

  describe('softDeleteCategory', () => {
    it('应成功软删除分类', async () => {
      const existing = { id: 1 } as BlogCategoryEntity;
      categoryRepo.findOne.mockResolvedValue(existing);
      categoryRepo.softRemove.mockResolvedValue(existing);

      await service.softDeleteCategory(1);
      expect(categoryRepo.softRemove).toHaveBeenCalledWith(existing);
    });

    it('分类不存在时应抛出 CATEGORY_NOT_FOUND', async () => {
      categoryRepo.findOne.mockResolvedValue(null);

      await expect(service.softDeleteCategory(999)).rejects.toThrow(DomainError);
      await expect(service.softDeleteCategory(999)).rejects.toThrow('分类不存在');
    });
  });

  // ─── updateCategorySortOrder ───

  describe('updateCategorySortOrder', () => {
    it('应成功更新排序权重', async () => {
      const existing = { id: 1 } as BlogCategoryEntity;
      categoryRepo.findOne.mockResolvedValue(existing);
      categoryRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await service.updateCategorySortOrder(1, 5);
      expect(categoryRepo.update).toHaveBeenCalledWith(1, { sortOrder: 5 });
    });

    it('分类不存在时应抛出 CATEGORY_NOT_FOUND', async () => {
      categoryRepo.findOne.mockResolvedValue(null);

      await expect(service.updateCategorySortOrder(999, 5)).rejects.toThrow(DomainError);
    });
  });

  // ─── assertParentExists ───

  describe('assertParentExists', () => {
    it('parentId 为 null 时应跳过校验', async () => {
      await expect(service.assertParentExists(null)).resolves.toBeUndefined();
      expect(categoryRepo.findOne).not.toHaveBeenCalled();
    });

    it('parentId 为 undefined 时应跳过校验', async () => {
      await expect(service.assertParentExists(undefined)).resolves.toBeUndefined();
    });

    it('父分类存在时应正常通过', async () => {
      categoryRepo.findOne.mockResolvedValue({ id: 10 } as BlogCategoryEntity);
      await expect(service.assertParentExists(10)).resolves.toBeUndefined();
    });

    it('父分类不存在时应抛出 CATEGORY_NOT_FOUND', async () => {
      categoryRepo.findOne.mockResolvedValue(null);
      await expect(service.assertParentExists(999)).rejects.toThrow(DomainError);
    });
  });

  // ─── assertNoCircularParent ───

  describe('assertNoCircularParent', () => {
    it('自引用（parentId === categoryId）时应抛出 CATEGORY_PARENT_INVALID', async () => {
      await expect(service.assertNoCircularParent(1, 1)).rejects.toThrow(DomainError);
      await expect(service.assertNoCircularParent(1, 1)).rejects.toThrow(
        '不能将分类的父级设为自身或其子分类',
      );
    });

    it('父级链中包含自身时应抛出 CATEGORY_PARENT_INVALID', async () => {
      // parentId=3 → parentId=2 → parentId=1(=categoryId) 形成环
      categoryRepo.findOne
        .mockResolvedValueOnce({ id: 3, parentId: 2 } as BlogCategoryEntity)
        .mockResolvedValueOnce({ id: 2, parentId: 1 } as BlogCategoryEntity);

      await expect(service.assertNoCircularParent(1, 3)).rejects.toThrow(DomainError);
    });

    it('脏数据导致环（A→B→A）时应抛出 CATEGORY_PARENT_INVALID', async () => {
      // parentId=2 → parentId=3 → parentId=2 形成环（非自引用，但 visited 检测到重复）
      categoryRepo.findOne
        .mockResolvedValueOnce({ id: 2, parentId: 3 } as BlogCategoryEntity)
        .mockResolvedValueOnce({ id: 3, parentId: 2 } as BlogCategoryEntity);

      await expect(service.assertNoCircularParent(1, 2)).rejects.toThrow(DomainError);
    });

    it('正常父级链（无环）时应正常通过', async () => {
      categoryRepo.findOne.mockResolvedValueOnce({ id: 2, parentId: null } as BlogCategoryEntity);
      await expect(service.assertNoCircularParent(1, 2)).resolves.toBeUndefined();
    });

    it('祖先链中遇到不存在的分类时应中断遍历并正常通过', async () => {
      categoryRepo.findOne.mockResolvedValueOnce({ id: 2, parentId: 99 } as BlogCategoryEntity);
      categoryRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.assertNoCircularParent(1, 2)).resolves.toBeUndefined();
    });

    it('parentId 为 null 时应直接通过', async () => {
      await expect(service.assertNoCircularParent(1, null)).resolves.toBeUndefined();
    });

    it('parentId 为 undefined 时应直接通过', async () => {
      await expect(service.assertNoCircularParent(1, undefined)).resolves.toBeUndefined();
    });
  });

  // ─── assertSlugUnique ───

  describe('assertSlugUnique', () => {
    it('slug 不存在时应正常通过', async () => {
      categoryRepo.findOne.mockResolvedValue(null);
      await expect(service.assertSlugUnique('new-slug')).resolves.toBeUndefined();
    });

    it('slug 已存在且非排除 ID 时应抛出 CATEGORY_SLUG_DUPLICATE', async () => {
      categoryRepo.findOne.mockResolvedValue({
        id: 2,
        slug: 'existing-slug',
      } as BlogCategoryEntity);
      await expect(service.assertSlugUnique('existing-slug')).rejects.toThrow(DomainError);
    });

    it('slug 已存在但等于排除 ID 时应正常通过', async () => {
      categoryRepo.findOne.mockResolvedValue({ id: 1, slug: 'my-slug' } as BlogCategoryEntity);
      await expect(service.assertSlugUnique('my-slug', 1)).resolves.toBeUndefined();
    });
  });
});
