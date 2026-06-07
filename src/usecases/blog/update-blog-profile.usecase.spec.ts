// src/usecases/blog/update-blog-profile.usecase.spec.ts

import { DomainError } from '@core/common/errors/domain-error';
import { BlogProfileService } from '@src/modules/blog/blog-profile.service';
import { UpdateBlogProfileUsecase } from './update-blog-profile.usecase';

describe('UpdateBlogProfileUsecase', () => {
  let usecase: UpdateBlogProfileUsecase;
  let profileService: { getProfile: jest.Mock; updateProfile: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  const mockProfileView = {
    id: 1,
    nickname: '博主',
    bio: '个人简介',
    avatarUrl: null,
    socialLinks: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    profileService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new UpdateBlogProfileUsecase(
      profileService as unknown as BlogProfileService,
      transactionRunner,
    );
  });

  it('应在事务内更新博主信息并返回结果', async () => {
    profileService.getProfile.mockResolvedValue({ id: 1 });
    profileService.updateProfile.mockResolvedValue(mockProfileView);

    const result = await usecase.execute({ nickname: '博主', bio: '个人简介' });

    expect(result.profile).toBe(mockProfileView);
    expect(profileService.getProfile).toHaveBeenCalledWith(expect.anything());
    expect(profileService.updateProfile).toHaveBeenCalledWith(
      1,
      { nickname: '博主', bio: '个人简介' },
      expect.anything(),
    );
  });

  it('博主信息不存在时应抛出 DomainError', async () => {
    profileService.getProfile.mockResolvedValue(null);

    await expect(usecase.execute({ nickname: '不存在' })).rejects.toThrow(DomainError);
  });

  it('无字段变更时应直接返回当前视图', async () => {
    profileService.getProfile.mockResolvedValue({ id: 1 });
    profileService.updateProfile.mockResolvedValue(mockProfileView);

    const result = await usecase.execute({});

    expect(result.profile).toBe(mockProfileView);
    expect(profileService.updateProfile).toHaveBeenCalledWith(1, {}, expect.anything());
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    profileService.getProfile.mockResolvedValue({ id: 1 });
    profileService.updateProfile.mockResolvedValue(mockProfileView);

    await usecase.execute({ nickname: '新昵称' });

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
