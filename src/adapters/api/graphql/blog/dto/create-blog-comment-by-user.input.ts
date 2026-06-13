// src/adapters/api/graphql/blog/dto/create-blog-comment-by-user.input.ts
// 登录用户创建评论输入（无需填写 authorName/authorEmail，由后端从用户信息自动填充）

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

@InputType({ description: '登录用户创建评论输入' })
export class CreateBlogCommentByUserInput {
  @Field(() => Int, { description: '文章 ID' })
  @IsInt({ message: '文章 ID 必须是整数' })
  @Min(1, { message: '文章 ID 必须为正整数' })
  postId!: number;

  @Field(() => String, { description: '评论内容' })
  @IsString({ message: '评论内容必须是字符串' })
  @IsNotEmpty({ message: '评论内容不能为空' })
  @MinLength(1, { message: '评论内容至少 1 个字符' })
  @MaxLength(65535, { message: '评论内容最多 65535 个字符' })
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
