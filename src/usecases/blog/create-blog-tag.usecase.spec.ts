// src/usecases/blog/create-blog-tag.usecase.spec.ts

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { BlogTagService } from '@src/modules/blog/blog-tag.service';
import { CreateBlogTagUsecase } from './create-blog-tag.usecase';

describe('CreateBlogTagUsecase', () => {
  let usecase: CreateBlogTagUsecase;
  let tagService: { assertSlugUnique: jest.Mock; createTag: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  const mockTagView = {
    id: 1,
    name: 'TypeScript',
    slug: 'typescript',
    postCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    tagService = {
      assertSlugUnique: jest.fn(),
      createTag: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new CreateBlogTagUsecase(tagService as unknown as BlogTagService, transactionRunner);
  });

  it('应在事务内创建标签并返回结果', async () => {
    tagService.createTag.mockResolvedValue(mockTagView);

    const result = await usecase.execute({ name: 'TypeScript', slug: 'typescript' });

    expect(result.tag).toBe(mockTagView);
    expect(tagService.assertSlugUnique).toHaveBeenCalledWith(
      'typescript',
      undefined,
      expect.anything(),
    );
    expect(tagService.createTag).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'TypeScript', slug: 'typescript' }),
      expect.anything(),
    );
  });

  it('slug 重复时应抛出 DomainError', async () => {
    tagService.assertSlugUnique.mockRejectedValue(
      new DomainError(BLOG_ERROR.TAG_SLUG_DUPLICATE, '标签 slug 已存在'),
    );

    await expect(usecase.execute({ name: '重复', slug: 'duplicate' })).rejects.toThrow(DomainError);
    expect(tagService.createTag).not.toHaveBeenCalled();
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    tagService.createTag.mockResolvedValue(mockTagView);

    await usecase.execute({ name: 'TypeScript', slug: 'typescript' });

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
