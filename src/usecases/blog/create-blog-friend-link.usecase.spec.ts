// src/usecases/blog/create-blog-friend-link.usecase.spec.ts
// 创建友情链接用例单元测试

import { CreateBlogFriendLinkUsecase } from './create-blog-friend-link.usecase';
import { BlogFriendLinkService } from '@src/modules/blog/blog-friend-link.service';

describe('CreateBlogFriendLinkUsecase', () => {
  let usecase: CreateBlogFriendLinkUsecase;
  let friendLinkService: { createFriendLink: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  const mockView = {
    id: 1,
    name: '测试友链',
    url: 'https://example.com',
    description: null,
    logoUrl: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    friendLinkService = { createFriendLink: jest.fn() };
    transactionRunner = { run: jest.fn((fn) => fn({})) };

    usecase = new CreateBlogFriendLinkUsecase(
      friendLinkService as unknown as BlogFriendLinkService,
      transactionRunner,
    );
  });

  it('应创建友链并返回结果', async () => {
    friendLinkService.createFriendLink.mockResolvedValue(mockView);

    const result = await usecase.execute({
      name: '测试友链',
      url: 'https://example.com',
    });

    expect(result.friendLink).toEqual(mockView);
    expect(friendLinkService.createFriendLink).toHaveBeenCalledWith(
      { name: '测试友链', url: 'https://example.com' },
      {},
    );
  });
});
