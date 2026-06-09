// src/usecases/blog/reply-blog-comment.usecase.spec.ts
// 管理员回复评论用例单元测试

import { ReplyBlogCommentUsecase } from './reply-blog-comment.usecase';
import { CreateBlogCommentUsecase } from './create-blog-comment.usecase';
import { BlogProfileQueryService } from '@src/modules/blog/queries/blog-profile.query.service';
import { BlogCommentStatus } from '@app-types/models/blog.types';
import { DomainError } from '@core/common/errors/domain-error';
import type { BlogCommentView } from '@src/modules/blog/blog.types';

describe('ReplyBlogCommentUsecase', () => {
  let usecase: ReplyBlogCommentUsecase;
  let createCommentUsecase: { execute: jest.Mock };
  let profileQueryService: { getProfile: jest.Mock };

  /** 创建 mock BlogCommentView，支持覆盖部分字段 */
  function createMockView(overrides?: Partial<BlogCommentView>): BlogCommentView {
    return {
      id: 1,
      postId: 10,
      parentId: null,
      replyToId: null,
      authorName: '博主',
      authorAvatar: null,
      content: '管理员回复内容',
      status: BlogCommentStatus.APPROVED,
      nestingLevel: 0,
      isAdminReply: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  beforeEach(() => {
    createCommentUsecase = { execute: jest.fn() };
    profileQueryService = { getProfile: jest.fn() };

    usecase = new ReplyBlogCommentUsecase(
      createCommentUsecase as unknown as CreateBlogCommentUsecase,
      profileQueryService as unknown as BlogProfileQueryService,
    );
  });

  it('应以博主昵称为作者名委托 CreateBlogCommentUsecase 创建管理员回复', async () => {
    profileQueryService.getProfile.mockResolvedValue({
      nickname: '博主昵称',
      avatarUrl: 'https://example.com/avatar.png',
    });
    createCommentUsecase.execute.mockResolvedValue({
      comment: createMockView({
        authorName: '博主昵称',
        authorAvatar: 'https://example.com/avatar.png',
      }),
    });

    const result = await usecase.execute({
      postId: 10,
      content: '管理员回复内容',
    });

    expect(result.comment.isAdminReply).toBe(true);
    expect(result.comment.status).toBe(BlogCommentStatus.APPROVED);
    expect(createCommentUsecase.execute).toHaveBeenCalledWith({
      postId: 10,
      content: '管理员回复内容',
      authorName: '博主昵称',
      authorEmail: 'noreply@blog.admin',
      authorAvatar: 'https://example.com/avatar.png',
      isAdminReply: true,
      initialStatus: BlogCommentStatus.APPROVED,
    });
  });

  it('无博主信息时应使用默认昵称"博主"和 null 头像', async () => {
    profileQueryService.getProfile.mockResolvedValue(null);
    createCommentUsecase.execute.mockResolvedValue({
      comment: createMockView({ authorName: '博主', authorAvatar: null }),
    });

    await usecase.execute({ postId: 10, content: '回复' });

    expect(createCommentUsecase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ authorName: '博主', authorAvatar: null }),
    );
  });

  it('文章不存在时应由 CreateBlogCommentUsecase 抛出 POST_NOT_FOUND', async () => {
    // ReplyBlogCommentUsecase 不再做存在性校验，由被委托的 usecase 负责
    profileQueryService.getProfile.mockResolvedValue({ nickname: '博主' });
    createCommentUsecase.execute.mockRejectedValue(
      new DomainError('BLOG.POST_NOT_FOUND', '文章不存在'),
    );

    await expect(usecase.execute({ postId: 999, content: '回复' })).rejects.toThrow(DomainError);
  });

  it('应正确传递 parentId 和 replyToId', async () => {
    profileQueryService.getProfile.mockResolvedValue({ nickname: '博主' });
    createCommentUsecase.execute.mockResolvedValue({
      comment: createMockView({ parentId: 5, replyToId: 3 }),
    });

    await usecase.execute({
      postId: 10,
      content: '回复评论',
      parentId: 5,
      replyToId: 3,
    });

    expect(createCommentUsecase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: 5, replyToId: 3 }),
    );
  });
});
