// src/modules/blog/blog-tag.service.spec.ts

import { DomainError } from '@core/common/errors/domain-error';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogTagEntity } from './entities/blog-tag.entity';
import { BlogTagService } from './blog-tag.service';

describe('BlogTagService', () => {
  let service: BlogTagService;
  let tagRepo: jest.Mocked<Repository<BlogTagEntity>>;

  const mockTagRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    softRemove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogTagService,
        { provide: getRepositoryToken(BlogTagEntity), useValue: mockTagRepo },
      ],
    }).compile();

    service = module.get<BlogTagService>(BlogTagService);
    tagRepo = module.get(getRepositoryToken(BlogTagEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTag', () => {
    it('应成功创建标签并返回 WriteResult', async () => {
      const savedEntity = {
        id: 1,
        name: 'TypeScript',
        slug: 'typescript',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BlogTagEntity;

      tagRepo.create.mockReturnValue(savedEntity);
      tagRepo.save.mockResolvedValue(savedEntity);

      const result = await service.createTag({ name: 'TypeScript', slug: 'typescript' });

      expect(result.id).toBe(1);
      expect(result.name).toBe('TypeScript');
      // WriteResult 不含 postCount
      expect(result).not.toHaveProperty('postCount');
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
});
