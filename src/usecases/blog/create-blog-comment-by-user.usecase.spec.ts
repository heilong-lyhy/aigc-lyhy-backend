// src/usecases/blog/create-blog-comment-by-user.usecase.spec.ts
// 登录用户创建评论用例单元测试

import { DomainError } from '@core/common/errors/domain-error';
import { BlogCommentStatus } from '@app-types/models/blog.types';
import { IdentityTypeEnum } from '@app-types/models/account.types';
import { CreateBlogCommentByUserUsecase } from './create-blog-comment-by-user.usecase';
import { CreateBlogCommentUsecase } from './create-blog-comment.usecase';
import { AccountQueryService } from '@modules/account/queries/account.query.service';

describe('CreateBlogCommentByUserUsecase', () => {
  let usecase: CreateBlogCommentByUserUsecase;
  let createCommentUsecase: { execute: jest.Mock };
  let accountQueryService: { getUserInfoViewStrict: jest.Mock };

  const mockUserInfo = {
    nickname: '测试用户',
    email: 'user@example.com',
    avatarUrl: 'https://avatar.example.com/user.png',
  };

  const mockCommentView = {
    id: 1,
    postId: 1,
    parentId: null,
    replyToId: null,
    authorName: '测试用户',
    authorEmail: 'user@example.com',
    authorAvatar: 'https://avatar.example.com/user.png',
    content: '评论内容',
    status: BlogCommentStatus.APPROVED,
    nestingLevel: 0,
    isAdminReply: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    createCommentUsecase = { execute: jest.fn() };
    accountQueryService = { getUserInfoViewStrict: jest.fn() };

    usecase = new CreateBlogCommentByUserUsecase(
      createCommentUsecase as unknown as CreateBlogCommentUsecase,
      accountQueryService as unknown as AccountQueryService,
    );
  });

  it('应以用户信息创建评论并自动填充 authorName/authorEmail/authorAvatar', async () => {
    accountQueryService.getUserInfoViewStrict.mockResolvedValue(mockUserInfo);
    createCommentUsecase.execute.mockResolvedValue({ comment: mockCommentView });

    const result = await usecase.execute({
      postId: 1,
      content: '评论内容',
      accountId: 100,
    });

    expect(result.comment).toBe(mockCommentView);
    expect(accountQueryService.getUserInfoViewStrict).toHaveBeenCalledWith({
      accountId: 100,
    });
    expect(createCommentUsecase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: 1,
        authorName: '测试用户',
        authorEmail: 'user@example.com',
        authorAvatar: 'https://avatar.example.com/user.png',
        content: '评论内容',
        isAdminReply: false,
        initialStatus: BlogCommentStatus.APPROVED,
      }),
    );
  });

  it('管理员回复时应设置 isAdminReply=true', async () => {
    accountQueryService.getUserInfoViewStrict.mockResolvedValue(mockUserInfo);
    createCommentUsecase.execute.mockResolvedValue({
      comment: { ...mockCommentView, isAdminReply: true },
    });

    await usecase.execute({
      postId: 1,
      content: '管理员回复',
      accountId: 100,
      activeRole: IdentityTypeEnum.ADMIN,
    });

    expect(createCommentUsecase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        isAdminReply: true,
        initialStatus: BlogCommentStatus.APPROVED,
      }),
    );
  });

  it('用户无邮箱时应使用占位邮箱', async () => {
    accountQueryService.getUserInfoViewStrict.mockResolvedValue({
      ...mockUserInfo,
      email: null,
    });
    createCommentUsecase.execute.mockResolvedValue({ comment: mockCommentView });

    await usecase.execute({
      postId: 1,
      content: '评论内容',
      accountId: 100,
    });

    expect(createCommentUsecase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        authorEmail: 'noreply@blog.user',
      }),
    );
  });

  it('用户无头像时 authorAvatar 应为 null', async () => {
    accountQueryService.getUserInfoViewStrict.mockResolvedValue({
      ...mockUserInfo,
      avatarUrl: null,
    });
    createCommentUsecase.execute.mockResolvedValue({ comment: mockCommentView });

    await usecase.execute({
      postId: 1,
      content: '评论内容',
      accountId: 100,
    });

    expect(createCommentUsecase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        authorAvatar: null,
      }),
    );
  });

  it('应透传 parentId 和 replyToId', async () => {
    accountQueryService.getUserInfoViewStrict.mockResolvedValue(mockUserInfo);
    createCommentUsecase.execute.mockResolvedValue({ comment: mockCommentView });

    await usecase.execute({
      postId: 1,
      content: '回复内容',
      accountId: 100,
      parentId: 5,
      replyToId: 3,
    });

    expect(createCommentUsecase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        parentId: 5,
        replyToId: 3,
      }),
    );
  });

  it('账户不存在时应抛出 DomainError', async () => {
    accountQueryService.getUserInfoViewStrict.mockRejectedValue(
      new DomainError('USER_INFO_NOT_FOUND', '账户信息不存在'),
    );

    await expect(usecase.execute({ postId: 1, content: '评论', accountId: 999 })).rejects.toThrow(
      DomainError,
    );

    expect(createCommentUsecase.execute).not.toHaveBeenCalled();
  });

  it('下游 CreateBlogCommentUsecase 失败时应抛出错误', async () => {
    accountQueryService.getUserInfoViewStrict.mockResolvedValue(mockUserInfo);
    createCommentUsecase.execute.mockRejectedValue(new DomainError('POST_NOT_FOUND', '文章不存在'));

    await expect(usecase.execute({ postId: 999, content: '评论', accountId: 100 })).rejects.toThrow(
      DomainError,
    );
  });
});
