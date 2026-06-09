// src/adapters/api/graphql/blog/dto/blog-posts.list.ts
// 文章列表响应

import { Field, Int, ObjectType } from '@nestjs/graphql';
import { BlogPostObjectType } from './blog-post.dto';

@ObjectType('BlogPostsListResponse', { description: '文章列表' })
export class BlogPostsListResponse {
  @Field(() => [BlogPostObjectType], { description: '文章列表' })
  list!: BlogPostObjectType[];

  @Field(() => Int, { description: '当前页码' })
  current!: number;

  @Field(() => Int, { description: '每页数量' })
  pageSize!: number;

  @Field(() => Int, { description: '总数量' })
  total!: number;
}
