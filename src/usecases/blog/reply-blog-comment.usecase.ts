// src/usecases/blog/reply-blog-comment.usecase.ts
// 管理员回复评论用例：获取博主信息 → 构造输入 → 委托 CreateBlogCommentUsecase
// 写流程（文章存在性校验 → 创建评论 → 更新计数）由 CreateBlogCommentUsecase 统一持有
// 遵守 usecases -> usecases 同域编排（one hop deep）

import { Injectable } from '@nestjs/common';
import type { CreateBlogCommentInput, BlogCommentView } from '@modules/blog/blog.types';
import { BlogProfileQueryService } from '@modules/blog/queries/blog-profile.query.service';
import { CreateBlogCommentUsecase } from './create-blog-comment.usecase';
import { BlogCommentStatus } from '@app-types/models/blog.types';

/** 博主信息不存在时的默认昵称 */
const DEFAULT_ADMIN_AUTHOR_NAME = '博主';

/** 管理员回复使用的占位邮箱（合法格式，不暴露真实邮箱） */
const ADMIN_REPLY_EMAIL = 'noreply@blog.admin';

export interface ReplyBlogCommentInput {
  readonly postId: number;
  readonly content: string;
  readonly parentId?: number;
  readonly replyToId?: number;
}

export interface ReplyBlogCommentResult {
  readonly comment: BlogCommentView;
}

@Injectable()
export class ReplyBlogCommentUsecase {
  constructor(
    private readonly createCommentUsecase: CreateBlogCommentUsecase,
    private readonly profileQueryService: BlogProfileQueryService,
  ) {}

  async execute(input: ReplyBlogCommentInput): Promise<ReplyBlogCommentResult> {
    // 获取博主信息作为管理员回复的作者（只读，无需事务上下文）
    const profile = await this.profileQueryService.getProfile();
    const authorName = profile?.nickname ?? DEFAULT_ADMIN_AUTHOR_NAME;

    // 构造 CreateBlogCommentInput，设置管理员标记，直接以 APPROVED 状态创建
    const createInput: CreateBlogCommentInput = {
      postId: input.postId,
      parentId: input.parentId,
      replyToId: input.replyToId,
      authorName,
      authorEmail: ADMIN_REPLY_EMAIL,
      authorAvatar: profile?.avatarUrl ?? null,
      content: input.content,
      isAdminReply: true,
      initialStatus: BlogCommentStatus.APPROVED,
    };

    // 委托 CreateBlogCommentUsecase 完成写流程（存在性校验 + 创建评论 + 更新计数）
    const { comment } = await this.createCommentUsecase.execute(createInput);

    return { comment };
  }
}
