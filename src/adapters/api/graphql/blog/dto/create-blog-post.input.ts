// src/adapters/api/graphql/blog/dto/create-blog-post.input.ts
// 创建文章输入

import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { BlogPostStatus } from '@app-types/models/blog.types';

@InputType({ description: '创建文章输入' })
export class CreateBlogPostInput {
  @Field(() => String, { description: '标题' })
  @IsString({ message: '标题必须是字符串' })
  @IsNotEmpty({ message: '标题不能为空' })
  @MinLength(1, { message: '标题至少 1 个字符' })
  title!: string;

  @Field(() => String, { description: 'URL slug' })
  @IsString({ message: 'slug 必须是字符串' })
  @IsNotEmpty({ message: 'slug 不能为空' })
  slug!: string;

  @Field(() => String, { description: '摘要', nullable: true })
  @IsOptional()
  @IsString({ message: '摘要必须是字符串' })
  excerpt?: string;

  @Field(() => String, { description: 'Markdown 正文' })
  @IsString({ message: '正文必须是字符串' })
  @IsNotEmpty({ message: '正文不能为空' })
  content!: string;

  @Field(() => String, { description: '渲染后正文', nullable: true })
  @IsOptional()
  @IsString({ message: '渲染后正文必须是字符串' })
  renderedContent?: string;

  @Field(() => String, { description: '封面图 URL', nullable: true })
  @IsOptional()
  @IsString({ message: '封面图 URL 必须是字符串' })
  coverImage?: string;

  @Field(() => BlogPostStatus, { description: '文章状态', nullable: true })
  @IsOptional()
  @IsEnum(BlogPostStatus, { message: '文章状态无效' })
  status?: BlogPostStatus;

  @Field(() => Int, { description: '分类 ID', nullable: true })
  @IsOptional()
  @IsInt({ message: '分类 ID 必须是整数' })
  categoryId?: number;

  @Field(() => [Int], { description: '标签 ID 列表', nullable: true })
  @IsOptional()
  @IsArray({ message: '标签 ID 列表必须是数组' })
  @IsInt({ each: true, message: '每个标签 ID 必须是整数' })
  tagIds?: number[];

  @Field(() => Boolean, { description: '是否置顶', nullable: true })
  @IsOptional()
  @IsBoolean({ message: '是否置顶必须是布尔值' })
  isPinned?: boolean;

  @Field(() => Date, { description: '发布时间', nullable: true })
  @IsOptional()
  publishedAt?: Date;
}
