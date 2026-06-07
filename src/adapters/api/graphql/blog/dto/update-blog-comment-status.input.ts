// src/adapters/api/graphql/blog/dto/update-blog-comment-status.input.ts
// 更新单条评论审核状态输入

import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt } from 'class-validator';
import { BlogCommentStatus } from '@app-types/models/blog.types';

@InputType({ description: '更新评论审核状态输入' })
export class UpdateBlogCommentStatusInput {
  @Field(() => Int, { description: '评论 ID' })
  @IsInt({ message: '评论 ID 必须是整数' })
  id!: number;

  @Field(() => BlogCommentStatus, { description: '审核状态' })
  @IsEnum(BlogCommentStatus, { message: '评论审核状态无效' })
  status!: BlogCommentStatus;
}
