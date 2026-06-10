// src/usecases/blog/delete-blog-category.usecase.spec.ts

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { BlogCategoryService } from '@modules/blog/blog-category.service';
import { DeleteBlogCategoryUsecase } from './delete-blog-category.usecase';

describe('DeleteBlogCategoryUsecase', () => {
  let usecase: DeleteBlogCategoryUsecase;
  let categoryService: { assertHasNoPosts: jest.Mock; softDeleteCategory: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  beforeEach(() => {
    categoryService = {
      assertHasNoPosts: jest.fn(),
      softDeleteCategory: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new DeleteBlogCategoryUsecase(
      categoryService as unknown as BlogCategoryService,
      transactionRunner,
    );
  });

  it('应在事务内删除分类', async () => {
    const result = await usecase.execute(1);

    expect(result.deleted).toBe(true);
    expect(categoryService.assertHasNoPosts).toHaveBeenCalledWith(1, expect.anything());
    expect(categoryService.softDeleteCategory).toHaveBeenCalledWith(1, expect.anything());
  });

  it('分类下有文章时应抛出 DomainError', async () => {
    categoryService.assertHasNoPosts.mockRejectedValue(
      new DomainError(BLOG_ERROR.CATEGORY_HAS_POSTS, '分类下存在文章，无法删除'),
    );

    await expect(usecase.execute(1)).rejects.toThrow(DomainError);
    expect(categoryService.softDeleteCategory).not.toHaveBeenCalled();
  });

  it('分类不存在时应抛出 DomainError', async () => {
    categoryService.softDeleteCategory.mockRejectedValue(
      new DomainError(BLOG_ERROR.CATEGORY_NOT_FOUND, '分类不存在'),
    );

    await expect(usecase.execute(999)).rejects.toThrow(DomainError);
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    await usecase.execute(1);

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
