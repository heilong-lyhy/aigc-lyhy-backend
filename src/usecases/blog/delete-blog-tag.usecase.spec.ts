// src/usecases/blog/delete-blog-tag.usecase.spec.ts

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { BlogTagService } from '@src/modules/blog/blog-tag.service';
import { DeleteBlogTagUsecase } from './delete-blog-tag.usecase';

describe('DeleteBlogTagUsecase', () => {
  let usecase: DeleteBlogTagUsecase;
  let tagService: { assertHasNoPostLinks: jest.Mock; softDeleteTag: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  beforeEach(() => {
    tagService = {
      assertHasNoPostLinks: jest.fn(),
      softDeleteTag: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new DeleteBlogTagUsecase(tagService as unknown as BlogTagService, transactionRunner);
  });

  it('应在事务内删除标签', async () => {
    const result = await usecase.execute(1);

    expect(result.deleted).toBe(true);
    expect(tagService.assertHasNoPostLinks).toHaveBeenCalledWith(1, expect.anything());
    expect(tagService.softDeleteTag).toHaveBeenCalledWith(1, expect.anything());
  });

  it('标签下有文章时应抛出 DomainError', async () => {
    tagService.assertHasNoPostLinks.mockRejectedValue(
      new DomainError(BLOG_ERROR.TAG_HAS_POSTS, '标签下存在文章，无法删除'),
    );

    await expect(usecase.execute(1)).rejects.toThrow(DomainError);
    expect(tagService.softDeleteTag).not.toHaveBeenCalled();
  });

  it('标签不存在时应抛出 DomainError', async () => {
    tagService.softDeleteTag.mockRejectedValue(
      new DomainError(BLOG_ERROR.TAG_NOT_FOUND, '标签不存在'),
    );

    await expect(usecase.execute(999)).rejects.toThrow(DomainError);
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    await usecase.execute(1);

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
