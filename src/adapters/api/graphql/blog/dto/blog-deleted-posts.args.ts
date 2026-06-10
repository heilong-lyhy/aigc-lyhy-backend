// src/adapters/api/graphql/blog/dto/blog-deleted-posts.args.ts
// 回收站文章列表查询参数：不含 status 筛选（回收站文章必然为 DELETED 状态）
// sortBy 默认值覆盖为 deletedAt（回收站按删除时间排序更合理）

import { ArgsType, Field, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { BlogPaginationArgs } from './blog-pagination.args';

@ArgsType()
export class BlogDeletedPostsArgs extends BlogPaginationArgs {
  @Field(() => Int, { description: '按分类 ID 筛选', nullable: true })
  @IsOptional()
  @IsInt({ message: '分类 ID 必须是整数' })
  @Min(1, { message: '分类 ID 必须大于 0' })
  categoryId?: number;

  @Field(() => String, { description: '按标题搜索（模糊匹配）', nullable: true })
  @IsOptional()
  @IsString({ message: '搜索关键词必须是字符串' })
  title?: string;

  // 覆盖基类默认值：回收站默认按删除时间排序
  @Field(() => String, { description: '排序字段', defaultValue: 'deletedAt', nullable: true })
  @IsOptional()
  @IsString({ message: '排序字段必须是字符串' })
  sortBy?: string = 'deletedAt';
}
