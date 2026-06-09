// src/adapters/api/graphql/blog/dto/create-blog-comment.input.ts
// 创建评论输入

import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

@InputType({ description: '创建评论输入' })
export class CreateBlogCommentInput {
  @Field(() => Int, { description: '文章 ID' })
  @IsInt({ message: '文章 ID 必须是整数' })
  @Min(1, { message: '文章 ID 必须为正整数' })
  postId!: number;

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

  @Field(() => String, { description: '评论者名称' })
  @IsString({ message: '评论者名称必须是字符串' })
  @IsNotEmpty({ message: '评论者名称不能为空' })
  @MaxLength(100, { message: '评论者名称最多 100 个字符' })
  authorName!: string;

  @Field(() => String, { description: '评论者邮箱' })
  @IsString({ message: '评论者邮箱必须是字符串' })
  @IsNotEmpty({ message: '评论者邮箱不能为空' })
  @IsEmail({}, { message: '邮箱格式不正确' })
  authorEmail!: string;

  @Field(() => String, { description: '评论者网站', nullable: true })
  @IsOptional()
  @IsString({ message: '评论者网站必须是字符串' })
  authorUrl?: string;

  @Field(() => String, { description: '评论内容' })
  @IsString({ message: '评论内容必须是字符串' })
  @IsNotEmpty({ message: '评论内容不能为空' })
  @MinLength(1, { message: '评论内容至少 1 个字符' })
  @MaxLength(65535, { message: '评论内容最多 65535 个字符' })
  content!: string;
}
