// src/adapters/api/graphql/blog/dto/blog-comments.list.ts
// 评论列表响应

import { Field, Int, ObjectType } from '@nestjs/graphql';
import { BlogCommentObjectType } from './blog-comment.dto';

@ObjectType({ description: '评论列表' })
export class BlogCommentsListResponse {
  @Field(() => [BlogCommentObjectType], { description: '评论列表' })
  list!: BlogCommentObjectType[];

  @Field(() => Int, { description: '当前页码' })
  current!: number;

  @Field(() => Int, { description: '每页数量' })
  pageSize!: number;

  @Field(() => Int, { description: '总数量' })
  total!: number;
}
