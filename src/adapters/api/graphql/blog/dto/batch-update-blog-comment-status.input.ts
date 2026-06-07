// src/adapters/api/graphql/blog/dto/batch-update-blog-comment-status.input.ts
// 批量更新评论审核状态输入

import { Field, InputType, Int } from '@nestjs/graphql';
import { IsArray, IsEnum, IsInt, IsNotEmpty } from 'class-validator';
import { BlogCommentStatus } from '@app-types/models/blog.types';

@InputType({ description: '批量更新评论审核状态输入' })
export class BatchUpdateBlogCommentStatusInput {
  @Field(() => [Int], { description: '评论 ID 列表' })
  @IsArray({ message: '评论 ID 列表必须是数组' })
  @IsInt({ each: true, message: '每个评论 ID 必须是整数' })
  @IsNotEmpty({ message: '评论 ID 列表不能为空' })
  ids!: number[];

  @Field(() => BlogCommentStatus, { description: '审核状态' })
  @IsEnum(BlogCommentStatus, { message: '评论审核状态无效' })
  status!: BlogCommentStatus;
}
