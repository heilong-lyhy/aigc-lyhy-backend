// src/usecases/blog/update-blog-friend-link.usecase.spec.ts
// 更新友情链接用例单元测试

import { UpdateBlogFriendLinkUsecase } from './update-blog-friend-link.usecase';
import { BlogFriendLinkService } from '@modules/blog/blog-friend-link.service';
import { DomainError } from '@core/common/errors/domain-error';

describe('UpdateBlogFriendLinkUsecase', () => {
  let usecase: UpdateBlogFriendLinkUsecase;
  let friendLinkService: { updateFriendLink: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  const mockView = {
    id: 1,
    name: '新名称',
    url: 'https://example.com',
    description: null,
    logoUrl: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    friendLinkService = { updateFriendLink: jest.fn() };
    transactionRunner = { run: jest.fn((fn) => fn({})) };

    usecase = new UpdateBlogFriendLinkUsecase(
      friendLinkService as unknown as BlogFriendLinkService,
      transactionRunner,
    );
  });

  it('应更新友链并返回结果', async () => {
    friendLinkService.updateFriendLink.mockResolvedValue(mockView);

    const result = await usecase.execute({ id: 1, name: '新名称' });

    expect(result.friendLink).toEqual(mockView);
    expect(friendLinkService.updateFriendLink).toHaveBeenCalledWith(1, { name: '新名称' }, {});
  });

  it('友链不存在时应抛出 DomainError', async () => {
    friendLinkService.updateFriendLink.mockRejectedValue(
      new DomainError('BLOG_FRIEND_LINK_NOT_FOUND', '友情链接不存在'),
    );

    await expect(usecase.execute({ id: 999, name: '新名称' })).rejects.toThrow(DomainError);
  });
});
