// src/modules/blog/blog-category.service.spec.ts

import { DomainError } from '@core/common/errors/domain-error';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogCategoryEntity } from './entities/blog-category.entity';
import { BlogCategoryService } from './blog-category.service';

describe('BlogCategoryService', () => {
  let service: BlogCategoryService;
  let categoryRepo: jest.Mocked<Repository<BlogCategoryEntity>>;

  const mockCategoryRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softRemove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogCategoryService,
        { provide: getRepositoryToken(BlogCategoryEntity), useValue: mockCategoryRepo },
      ],
    }).compile();

    service = module.get<BlogCategoryService>(BlogCategoryService);
    categoryRepo = module.get(getRepositoryToken(BlogCategoryEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── createCategory ───

  describe('createCategory', () => {
    it('应成功创建分类并返回 WriteResult', async () => {
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

      const result = await service.createCategory(input);

      expect(result.id).toBe(1);
      expect(result.name).toBe('技术');
      // WriteResult 不含 postCount
      expect(result).not.toHaveProperty('postCount');
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

      const updated = { ...existing, name: '新名称' };

      categoryRepo.findOne.mockResolvedValueOnce(existing);
      categoryRepo.update.mockResolvedValue(undefined);
      categoryRepo.findOne.mockResolvedValueOnce(updated);

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
      categoryRepo.update.mockResolvedValue(undefined);

      await service.updateCategorySortOrder(1, 5);
      expect(categoryRepo.update).toHaveBeenCalledWith(1, { sortOrder: 5 });
    });

    it('分类不存在时应抛出 CATEGORY_NOT_FOUND', async () => {
      categoryRepo.findOne.mockResolvedValue(null);

      await expect(service.updateCategorySortOrder(999, 5)).rejects.toThrow(DomainError);
    });
  });
});
