// src/usecases/blog/create-blog-category.usecase.spec.ts

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { BlogCategoryService } from '@modules/blog/blog-category.service';
import { CreateBlogCategoryUsecase } from './create-blog-category.usecase';

describe('CreateBlogCategoryUsecase', () => {
  let usecase: CreateBlogCategoryUsecase;
  let categoryService: {
    assertSlugUnique: jest.Mock;
    assertParentExists: jest.Mock;
    createCategory: jest.Mock;
  };
  let transactionRunner: { run: jest.Mock };

  const mockCategoryView = {
    id: 1,
    name: '技术',
    slug: 'tech',
    description: null,
    parentId: null,
    sortOrder: 0,
    postCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    categoryService = {
      assertSlugUnique: jest.fn(),
      assertParentExists: jest.fn(),
      createCategory: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new CreateBlogCategoryUsecase(
      categoryService as unknown as BlogCategoryService,
      transactionRunner,
    );
  });

  it('应在事务内创建分类并返回结果', async () => {
    categoryService.createCategory.mockResolvedValue(mockCategoryView);

    const result = await usecase.execute({ name: '技术', slug: 'tech' });

    expect(result.category).toBe(mockCategoryView);
    expect(categoryService.assertSlugUnique).toHaveBeenCalledWith(
      'tech',
      undefined,
      expect.anything(),
    );
    expect(categoryService.assertParentExists).toHaveBeenCalledWith(undefined, expect.anything());
    expect(categoryService.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({ name: '技术', slug: 'tech' }),
      expect.anything(),
    );
  });

  it('应校验 slug 唯一性', async () => {
    categoryService.assertSlugUnique.mockRejectedValue(
      new DomainError(BLOG_ERROR.CATEGORY_SLUG_DUPLICATE, '分类 slug 已存在'),
    );

    await expect(usecase.execute({ name: '重复', slug: 'duplicate' })).rejects.toThrow(DomainError);
    expect(categoryService.createCategory).not.toHaveBeenCalled();
  });

  it('应校验 parentId 存在性', async () => {
    categoryService.assertParentExists.mockRejectedValue(
      new DomainError(BLOG_ERROR.CATEGORY_NOT_FOUND, '父级分类不存在'),
    );

    await expect(usecase.execute({ name: '子分类', slug: 'sub', parentId: 999 })).rejects.toThrow(
      DomainError,
    );
    expect(categoryService.createCategory).not.toHaveBeenCalled();
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    categoryService.createCategory.mockResolvedValue(mockCategoryView);

    await usecase.execute({ name: '技术', slug: 'tech' });

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
