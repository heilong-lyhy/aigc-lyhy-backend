// src/modules/blog/blog-profile.service.spec.ts

import { DomainError } from '@core/common/errors/domain-error';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogProfileEntity } from './entities/blog-profile.entity';
import { BlogProfileService } from './blog-profile.service';

describe('BlogProfileService', () => {
  let service: BlogProfileService;
  let profileRepo: jest.Mocked<Repository<BlogProfileEntity>>;

  const mockProfileRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogProfileService,
        { provide: getRepositoryToken(BlogProfileEntity), useValue: mockProfileRepo },
      ],
    }).compile();

    service = module.get<BlogProfileService>(BlogProfileService);
    profileRepo = module.get(getRepositoryToken(BlogProfileEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createProfile', () => {
    it('应成功创建博主信息', async () => {
      const savedEntity = {
        id: 1,
        nickname: '博主',
        bio: null,
        avatarUrl: null,
        socialLinks: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BlogProfileEntity;

      profileRepo.create.mockReturnValue(savedEntity);
      profileRepo.save.mockResolvedValue(savedEntity);

      const result = await service.createProfile('博主');

      expect(result.id).toBe(1);
      expect(result.nickname).toBe('博主');
    });
  });

  describe('updateProfile', () => {
    it('应成功更新博主信息', async () => {
      const existing = {
        id: 1,
        nickname: '博主',
        bio: null,
        avatarUrl: null,
        socialLinks: null,
      } as BlogProfileEntity;

      const updated = {
        ...existing,
        nickname: '新昵称',
        bio: '个人简介',
      } as BlogProfileEntity;

      profileRepo.findOne.mockResolvedValueOnce(existing);
      profileRepo.update.mockResolvedValue(undefined);
      profileRepo.findOne.mockResolvedValueOnce(updated);

      const result = await service.updateProfile(1, { nickname: '新昵称', bio: '个人简介' });

      expect(result.nickname).toBe('新昵称');
      expect(result.bio).toBe('个人简介');
    });

    it('博主信息不存在时应抛出 PROFILE_NOT_FOUND', async () => {
      profileRepo.findOne.mockResolvedValue(null);

      await expect(service.updateProfile(999, { nickname: '不存在' })).rejects.toThrow(DomainError);
      await expect(service.updateProfile(999, { nickname: '不存在' })).rejects.toThrow(
        '博主信息不存在',
      );
    });

    it('无字段变更时应直接返回当前视图', async () => {
      const existing = {
        id: 1,
        nickname: '博主',
        bio: null,
        avatarUrl: null,
        socialLinks: null,
      } as BlogProfileEntity;

      profileRepo.findOne.mockResolvedValue(existing);

      const result = await service.updateProfile(1, {});

      expect(result.nickname).toBe('博主');
      expect(profileRepo.update).not.toHaveBeenCalled();
    });
  });
});
