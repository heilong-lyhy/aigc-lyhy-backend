// src/adapters/api/graphql/blog/dto/blog-posts.args.ts
// 文章列表查询参数：支持状态筛选 + 通用分页

import { ArgsType, Field, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { BlogPostStatus } from '@app-types/models/blog.types';
import { BlogPaginationArgs } from './blog-pagination.args';

@ArgsType()
export class BlogPostsArgs extends BlogPaginationArgs {
  @Field(() => BlogPostStatus, { description: '按状态筛选', nullable: true })
  @IsOptional()
  @IsEnum(BlogPostStatus, { message: '文章状态无效' })
  status?: BlogPostStatus;

  @Field(() => Int, { description: '按分类 ID 筛选', nullable: true })
  @IsOptional()
  @IsInt({ message: '分类 ID 必须是整数' })
  @Min(1, { message: '分类 ID 必须大于 0' })
  categoryId?: number;

  @Field(() => String, { description: '按标题搜索（模糊匹配）', nullable: true })
  @IsOptional()
  @IsString({ message: '搜索关键词必须是字符串' })
  title?: string;
}
