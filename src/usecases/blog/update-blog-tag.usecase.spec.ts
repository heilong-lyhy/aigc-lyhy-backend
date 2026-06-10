// src/usecases/blog/update-blog-tag.usecase.spec.ts

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { BlogTagService } from '@modules/blog/blog-tag.service';
import { UpdateBlogTagUsecase } from './update-blog-tag.usecase';

describe('UpdateBlogTagUsecase', () => {
  let usecase: UpdateBlogTagUsecase;
  let tagService: {
    assertSlugUnique: jest.Mock;
    updateTag: jest.Mock;
  };
  let transactionRunner: { run: jest.Mock };

  const mockTagView = {
    id: 1,
    name: '新名称',
    slug: 'new-slug',
    postCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    tagService = {
      assertSlugUnique: jest.fn(),
      updateTag: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new UpdateBlogTagUsecase(tagService as unknown as BlogTagService, transactionRunner);
  });

  it('应在事务内更新标签并返回结果', async () => {
    tagService.updateTag.mockResolvedValue(mockTagView);

    const result = await usecase.execute(1, { name: '新名称' });

    expect(result.tag).toBe(mockTagView);
    expect(tagService.updateTag).toHaveBeenCalledWith(1, { name: '新名称' }, expect.anything());
  });

  it('更新 slug 时应校验唯一性', async () => {
    tagService.updateTag.mockResolvedValue(mockTagView);

    await usecase.execute(1, { slug: 'new-slug' });

    expect(tagService.assertSlugUnique).toHaveBeenCalledWith('new-slug', 1, expect.anything());
  });

  it('不更新 slug 时不应校验唯一性', async () => {
    tagService.updateTag.mockResolvedValue(mockTagView);

    await usecase.execute(1, { name: '新名称' });

    expect(tagService.assertSlugUnique).not.toHaveBeenCalled();
  });

  it('同时更新 name 和 slug 时应校验 slug 唯一性', async () => {
    tagService.updateTag.mockResolvedValue(mockTagView);

    await usecase.execute(1, { name: '新名称', slug: 'new-slug' });

    expect(tagService.assertSlugUnique).toHaveBeenCalledWith('new-slug', 1, expect.anything());
    expect(tagService.updateTag).toHaveBeenCalledWith(
      1,
      { name: '新名称', slug: 'new-slug' },
      expect.anything(),
    );
  });

  it('slug 重复时应抛出 DomainError', async () => {
    tagService.assertSlugUnique.mockRejectedValue(
      new DomainError(BLOG_ERROR.TAG_SLUG_DUPLICATE, '标签 slug 已存在'),
    );

    await expect(usecase.execute(1, { slug: 'duplicate' })).rejects.toThrow(DomainError);
  });

  it('标签不存在时应抛出 DomainError', async () => {
    tagService.updateTag.mockRejectedValue(new DomainError(BLOG_ERROR.TAG_NOT_FOUND, '标签不存在'));

    await expect(usecase.execute(999, { name: '不存在' })).rejects.toThrow(DomainError);
  });
});
