// src/adapters/api/graphql/blog/dto/blog-comments.args.ts
// 评论列表查询参数：支持按文章 ID 筛选 + 状态筛选 + 通用分页

import { ArgsType, Field, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { BlogCommentStatus } from '@app-types/models/blog.types';
import { BlogPaginationArgs } from './blog-pagination.args';

@ArgsType()
export class BlogCommentsArgs extends BlogPaginationArgs {
  @Field(() => Int, { description: '按文章 ID 筛选', nullable: true })
  @IsOptional()
  @IsInt({ message: '文章 ID 必须是整数' })
  @Min(1, { message: '文章 ID 必须大于 0' })
  postId?: number;

  @Field(() => BlogCommentStatus, { description: '按审核状态筛选', nullable: true })
  @IsOptional()
  @IsEnum(BlogCommentStatus, { message: '评论状态无效' })
  status?: BlogCommentStatus;
}
