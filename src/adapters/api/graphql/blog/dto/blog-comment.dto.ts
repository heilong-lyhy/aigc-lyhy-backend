// src/adapters/api/graphql/blog/dto/blog-comment.dto.ts
// 评论 ObjectType：薄映射 BlogCommentView

import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { BlogCommentStatus } from '@app-types/models/blog.types';

@ObjectType('BlogComment', { description: '评论' })
export class BlogCommentObjectType {
  @Field(() => ID, { description: '评论 ID' })
  id!: number;

  @Field(() => Int, { description: '文章 ID' })
  postId!: number;

  @Field(() => Int, { description: '父评论 ID', nullable: true })
  parentId!: number | null;

  @Field(() => Int, { description: '回复目标评论 ID', nullable: true })
  replyToId!: number | null;

  @Field(() => String, { description: '评论者名称' })
  authorName!: string;

  @Field(() => String, { description: '评论者头像', nullable: true })
  authorAvatar!: string | null;

  @Field(() => String, { description: '评论内容' })
  content!: string;

  @Field(() => BlogCommentStatus, { description: '审核状态' })
  status!: BlogCommentStatus;

  @Field(() => Int, { description: '嵌套层级' })
  nestingLevel!: number;

  @Field(() => Date, { description: '创建时间' })
  createdAt!: Date;

  @Field(() => Date, { description: '更新时间' })
  updatedAt!: Date;
}
