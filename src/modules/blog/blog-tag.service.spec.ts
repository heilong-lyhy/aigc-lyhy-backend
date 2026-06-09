// src/modules/blog/blog-tag.service.spec.ts

import { DomainError } from '@core/common/errors/domain-error';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogTagEntity } from './entities/blog-tag.entity';
import { BlogTagService } from './blog-tag.service';
import { BlogTagQueryService } from './queries/blog-tag.query.service';

describe('BlogTagService', () => {
  let service: BlogTagService;
  let tagRepo: jest.Mocked<Repository<BlogTagEntity>>;
  let queryService: { findTagById: jest.Mock };

  const mockTagRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    softRemove: jest.fn(),
  };

  const mockQueryService = {
    findTagById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogTagService,
        { provide: getRepositoryToken(BlogTagEntity), useValue: mockTagRepo },
        { provide: BlogTagQueryService, useValue: mockQueryService },
      ],
    }).compile();

    service = module.get<BlogTagService>(BlogTagService);
    tagRepo = module.get(getRepositoryToken(BlogTagEntity));
    queryService = mockQueryService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTag', () => {
    it('应成功创建标签并委托 QueryService 返回视图', async () => {
      const savedEntity = {
        id: 1,
        name: 'TypeScript',
        slug: 'typescript',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BlogTagEntity;

      tagRepo.create.mockReturnValue(savedEntity);
      tagRepo.save.mockResolvedValue(savedEntity);
      queryService.findTagById.mockResolvedValue({
        id: 1,
        name: 'TypeScript',
        slug: 'typescript',
        postCount: 0,
      });

      const result = await service.createTag({ name: 'TypeScript', slug: 'typescript' });

      expect(result.id).toBe(1);
      expect(result.name).toBe('TypeScript');
      expect(queryService.findTagById).toHaveBeenCalledWith(1, undefined);
    });
  });

  describe('softDeleteTag', () => {
    it('应成功软删除标签', async () => {
      const existing = { id: 1 } as BlogTagEntity;
      tagRepo.findOne.mockResolvedValue(existing);
      tagRepo.softRemove.mockResolvedValue(existing);

      await service.softDeleteTag(1);
      expect(tagRepo.softRemove).toHaveBeenCalledWith(existing);
    });

    it('标签不存在时应抛出 TAG_NOT_FOUND', async () => {
      tagRepo.findOne.mockResolvedValue(null);

      await expect(service.softDeleteTag(999)).rejects.toThrow(DomainError);
      await expect(service.softDeleteTag(999)).rejects.toThrow('标签不存在');
    });
  });

  // ─── assertSlugUnique ───

  describe('assertSlugUnique', () => {
    it('slug 不存在时应正常通过', async () => {
      tagRepo.findOne.mockResolvedValue(null);

      await expect(service.assertSlugUnique('new-slug')).resolves.toBeUndefined();
    });

    it('slug 已存在且非排除 ID 时应抛出 TAG_SLUG_DUPLICATE', async () => {
      tagRepo.findOne.mockResolvedValue({ id: 2, slug: 'existing-slug' } as BlogTagEntity);

      await expect(service.assertSlugUnique('existing-slug')).rejects.toThrow(DomainError);
      await expect(service.assertSlugUnique('existing-slug')).rejects.toThrow('标签 slug 已存在');
    });

    it('slug 已存在但等于排除 ID 时应正常通过', async () => {
      tagRepo.findOne.mockResolvedValue({ id: 1, slug: 'my-slug' } as BlogTagEntity);

      await expect(service.assertSlugUnique('my-slug', 1)).resolves.toBeUndefined();
    });
  });

  // ─── assertHasNoPostLinks ───

  describe('assertHasNoPostLinks', () => {
    it('标签下无文章时应正常通过', async () => {
      queryService.findTagById.mockResolvedValue({ id: 1, postCount: 0 });

      await expect(service.assertHasNoPostLinks(1)).resolves.toBeUndefined();
    });

    it('标签下有文章时应抛出 TAG_HAS_POSTS', async () => {
      queryService.findTagById.mockResolvedValue({ id: 1, postCount: 3 });

      await expect(service.assertHasNoPostLinks(1)).rejects.toThrow(DomainError);
      await expect(service.assertHasNoPostLinks(1)).rejects.toThrow('标签下存在文章，无法删除');
    });

    it('标签不存在时应抛出 TAG_NOT_FOUND', async () => {
      queryService.findTagById.mockResolvedValue(null);

      await expect(service.assertHasNoPostLinks(999)).rejects.toThrow(DomainError);
      await expect(service.assertHasNoPostLinks(999)).rejects.toThrow('标签不存在');
    });
  });
});
