// src/adapters/api/graphql/blog/dto/blog-published-posts.args.ts
// 公开文章列表查询参数：支持分类/关键词/标签筛选 + 通用分页

import { ArgsType, Field, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { BlogPaginationArgs } from './blog-pagination.args';

@ArgsType()
export class BlogPublishedPostsArgs extends BlogPaginationArgs {
  @Field(() => Int, { description: '按分类 ID 筛选', nullable: true })
  @IsOptional()
  @IsInt({ message: '分类 ID 必须是整数' })
  @Min(1, { message: '分类 ID 必须大于 0' })
  categoryId?: number;

  @Field(() => String, { description: '按标题搜索（模糊匹配）', nullable: true })
  @IsOptional()
  @IsString({ message: '搜索关键词必须是字符串' })
  title?: string;

  @Field(() => Int, { description: '按标签 ID 筛选', nullable: true })
  @IsOptional()
  @IsInt({ message: '标签 ID 必须是整数' })
  @Min(1, { message: '标签 ID 必须大于 0' })
  tagId?: number;
}
