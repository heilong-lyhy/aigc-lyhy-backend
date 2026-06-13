// src/usecases/blog/create-blog-comment-by-user.usecase.ts
// 登录用户创建评论用例：获取用户信息 → 构造输入 → 委托 CreateBlogCommentUsecase
// 跨域读取 Account UserInfo，由 Usecase 编排（遵守跨域读取规则）
// 遵守 usecases -> usecases 同域编排（one hop deep）

import { Injectable } from '@nestjs/common';
import type { CreateBlogCommentInput, BlogCommentView } from '@modules/blog/blog.types';
import { AccountQueryService } from '@modules/account/queries/account.query.service';
import { CreateBlogCommentUsecase } from './create-blog-comment.usecase';
import { IdentityTypeEnum } from '@app-types/models/account.types';
import { BlogCommentStatus } from '@app-types/models/blog.types';

/** 登录用户无邮箱时的占位邮箱（合法格式，不暴露真实邮箱） */
const USER_NO_EMAIL_PLACEHOLDER = 'noreply@blog.user';

export interface CreateBlogCommentByUserInput {
  readonly postId: number;
  readonly content: string;
  readonly parentId?: number;
  readonly replyToId?: number;
  readonly accountId: number;
  readonly activeRole?: IdentityTypeEnum;
}

export interface CreateBlogCommentByUserResult {
  readonly comment: BlogCommentView;
}

@Injectable()
export class CreateBlogCommentByUserUsecase {
  constructor(
    private readonly createCommentUsecase: CreateBlogCommentUsecase,
    private readonly accountQueryService: AccountQueryService,
  ) {}

  async execute(input: CreateBlogCommentByUserInput): Promise<CreateBlogCommentByUserResult> {
    // 跨域读取：获取用户信息以填充 authorName / authorEmail / authorAvatar
    const userInfo = await this.accountQueryService.getUserInfoViewStrict({
      accountId: input.accountId,
    });

    const isAdmin = input.activeRole === IdentityTypeEnum.ADMIN;

    // 构造 CreateBlogCommentInput，自动填充用户信息
    const createInput: CreateBlogCommentInput = {
      postId: input.postId,
      parentId: input.parentId,
      replyToId: input.replyToId,
      authorName: userInfo.nickname,
      authorEmail: userInfo.email ?? USER_NO_EMAIL_PLACEHOLDER,
      authorAvatar: userInfo.avatarUrl ?? null,
      content: input.content,
      isAdminReply: isAdmin,
      initialStatus: BlogCommentStatus.APPROVED,
    };

    // 委托 CreateBlogCommentUsecase 完成写流程（存在性校验 + 创建评论 + 更新计数）
    const { comment } = await this.createCommentUsecase.execute(createInput);

    return { comment };
  }
}
