// src/adapters/api/graphql/blog/dto/blog-post.args.ts
// 文章查询参数：单篇查询

import { ArgsType, Field, Int } from '@nestjs/graphql';
import { IsInt, Min } from 'class-validator';

@ArgsType()
export class BlogPostArgs {
  @Field(() => Int, { description: '文章 ID' })
  @IsInt({ message: '文章 ID 必须是整数' })
  @Min(1, { message: '文章 ID 必须大于 0' })
  id!: number;
}
