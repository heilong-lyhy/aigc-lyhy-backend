// src/usecases/blog/delete-blog-friend-link.usecase.spec.ts
// 删除友情链接用例单元测试

import { DeleteBlogFriendLinkUsecase } from './delete-blog-friend-link.usecase';
import { BlogFriendLinkService } from '@src/modules/blog/blog-friend-link.service';
import { DomainError } from '@core/common/errors/domain-error';

describe('DeleteBlogFriendLinkUsecase', () => {
  let usecase: DeleteBlogFriendLinkUsecase;
  let friendLinkService: { softDeleteFriendLink: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  beforeEach(() => {
    friendLinkService = { softDeleteFriendLink: jest.fn() };
    transactionRunner = { run: jest.fn((fn) => fn({})) };

    usecase = new DeleteBlogFriendLinkUsecase(
      friendLinkService as unknown as BlogFriendLinkService,
      transactionRunner,
    );
  });

  it('应删除友链并返回 deleted: true', async () => {
    friendLinkService.softDeleteFriendLink.mockResolvedValue(undefined);

    const result = await usecase.execute(1);

    expect(result.deleted).toBe(true);
    expect(friendLinkService.softDeleteFriendLink).toHaveBeenCalledWith(1, {});
  });

  it('友链不存在时应抛出 DomainError', async () => {
    friendLinkService.softDeleteFriendLink.mockRejectedValue(
      new DomainError('BLOG_FRIEND_LINK_NOT_FOUND', '友情链接不存在'),
    );

    await expect(usecase.execute(999)).rejects.toThrow(DomainError);
  });
});
