// src/modules/blog/queries/blog-profile.query.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlogProfileEntity } from '../entities/blog-profile.entity';
import { BlogProfileQueryService } from './blog-profile.query.service';

describe('BlogProfileQueryService', () => {
  let service: BlogProfileQueryService;

  const mockEntity = {
    id: 1,
    nickname: '博主',
    bio: '个人简介',
    avatarUrl: 'https://example.com/avatar.png',
    socialLinks: { github: 'https://github.com/test' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
    deletedAt: null,
  } as unknown as BlogProfileEntity;

  const mockProfileRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogProfileQueryService,
        { provide: getRepositoryToken(BlogProfileEntity), useValue: mockProfileRepo },
      ],
    }).compile();

    service = module.get<BlogProfileQueryService>(BlogProfileQueryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── getProfile ───

  describe('getProfile', () => {
    it('存在博主信息时应返回视图', async () => {
      mockProfileRepo.findOne.mockResolvedValue(mockEntity);

      const result = await service.getProfile();

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.nickname).toBe('博主');
      expect(result!.bio).toBe('个人简介');
      expect(result!.socialLinks).toEqual({ github: 'https://github.com/test' });
      expect(mockProfileRepo.findOne).toHaveBeenCalledWith({ order: { id: 'ASC' } });
    });

    it('不存在博主信息时应返回 null', async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      const result = await service.getProfile();

      expect(result).toBeNull();
    });
  });

  // ─── findProfileById ───

  describe('findProfileById', () => {
    it('存在时应返回视图', async () => {
      mockProfileRepo.findOne.mockResolvedValue(mockEntity);

      const result = await service.findProfileById(1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.nickname).toBe('博主');
      expect(mockProfileRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('不存在时应返回 null', async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      const result = await service.findProfileById(999);

      expect(result).toBeNull();
    });
  });
});
