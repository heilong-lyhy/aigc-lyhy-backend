// src/adapters/api/graphql/blog/dto/reply-blog-comment.input.ts
// 管理员回复评论输入

import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

@InputType({ description: '管理员回复评论输入' })
export class ReplyBlogCommentInput {
  @Field(() => Int, { description: '文章 ID' })
  @IsInt({ message: '文章 ID 必须是整数' })
  @Min(1, { message: '文章 ID 必须为正整数' })
  postId!: number;

  @Field(() => String, { description: '回复内容' })
  @IsString({ message: '回复内容必须是字符串' })
  @IsNotEmpty({ message: '回复内容不能为空' })
  @MinLength(1, { message: '回复内容至少 1 个字符' })
  @MaxLength(65535, { message: '回复内容最多 65535 个字符' })
  content!: string;

  @Field(() => Int, { description: '父评论 ID', nullable: true })
  @IsOptional()
  @IsInt({ message: '父评论 ID 必须是整数' })
  @Min(1, { message: '父评论 ID 必须为正整数' })
  parentId?: number;

  @Field(() => Int, { description: '回复目标评论 ID', nullable: true })
  @IsOptional()
  @IsInt({ message: '回复目标评论 ID 必须是整数' })
  @Min(1, { message: '回复目标评论 ID 必须为正整数' })
  replyToId?: number;
}
