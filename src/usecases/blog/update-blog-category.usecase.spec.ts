// src/usecases/blog/update-blog-category.usecase.spec.ts

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { BlogCategoryService } from '@src/modules/blog/blog-category.service';
import { UpdateBlogCategoryUsecase } from './update-blog-category.usecase';

describe('UpdateBlogCategoryUsecase', () => {
  let usecase: UpdateBlogCategoryUsecase;
  let categoryService: {
    assertSlugUnique: jest.Mock;
    assertParentExists: jest.Mock;
    assertNoCircularParent: jest.Mock;
    updateCategory: jest.Mock;
  };
  let transactionRunner: { run: jest.Mock };

  const mockCategoryView = {
    id: 1,
    name: '新名称',
    slug: 'new-slug',
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
      assertNoCircularParent: jest.fn(),
      updateCategory: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new UpdateBlogCategoryUsecase(
      categoryService as unknown as BlogCategoryService,
      transactionRunner,
    );
  });

  it('应在事务内更新分类并返回结果', async () => {
    categoryService.updateCategory.mockResolvedValue(mockCategoryView);

    const result = await usecase.execute(1, { name: '新名称' });

    expect(result.category).toBe(mockCategoryView);
    expect(categoryService.updateCategory).toHaveBeenCalledWith(
      1,
      { name: '新名称' },
      expect.anything(),
    );
  });

  it('更新 slug 时应校验唯一性', async () => {
    categoryService.updateCategory.mockResolvedValue(mockCategoryView);

    await usecase.execute(1, { slug: 'new-slug' });

    expect(categoryService.assertSlugUnique).toHaveBeenCalledWith('new-slug', 1, expect.anything());
  });

  it('不更新 slug 时不应校验唯一性', async () => {
    categoryService.updateCategory.mockResolvedValue(mockCategoryView);

    await usecase.execute(1, { name: '新名称' });

    expect(categoryService.assertSlugUnique).not.toHaveBeenCalled();
  });

  it('更新 parentId 时应校验存在性和循环引用', async () => {
    categoryService.updateCategory.mockResolvedValue({ ...mockCategoryView, parentId: 2 });

    await usecase.execute(1, { parentId: 2 });

    expect(categoryService.assertParentExists).toHaveBeenCalledWith(2, expect.anything());
    expect(categoryService.assertNoCircularParent).toHaveBeenCalledWith(1, 2, expect.anything());
  });

  it('不更新 parentId 时不应校验父级', async () => {
    categoryService.updateCategory.mockResolvedValue(mockCategoryView);

    await usecase.execute(1, { name: '新名称' });

    expect(categoryService.assertParentExists).not.toHaveBeenCalled();
    expect(categoryService.assertNoCircularParent).not.toHaveBeenCalled();
  });

  it('slug 重复时应抛出 DomainError', async () => {
    categoryService.assertSlugUnique.mockRejectedValue(
      new DomainError(BLOG_ERROR.CATEGORY_SLUG_DUPLICATE, '分类 slug 已存在'),
    );

    await expect(usecase.execute(1, { slug: 'duplicate' })).rejects.toThrow(DomainError);
  });

  it('循环引用时应抛出 DomainError', async () => {
    categoryService.assertNoCircularParent.mockRejectedValue(
      new DomainError(BLOG_ERROR.CATEGORY_PARENT_INVALID, '不能将分类的父级设为自身或其子分类'),
    );

    await expect(usecase.execute(1, { parentId: 2 })).rejects.toThrow(DomainError);
  });

  it('分类不存在时应抛出 DomainError', async () => {
    categoryService.updateCategory.mockRejectedValue(
      new DomainError(BLOG_ERROR.CATEGORY_NOT_FOUND, '分类不存在'),
    );

    await expect(usecase.execute(999, { name: '不存在' })).rejects.toThrow(DomainError);
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    categoryService.updateCategory.mockResolvedValue(mockCategoryView);

    await usecase.execute(1, { name: '新名称' });

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
