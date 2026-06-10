// src/adapters/api/graphql/blog/dto/blog-post.dto.ts
// 文章 ObjectType：薄映射 BlogPostView

import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { BlogPostStatus } from '@app-types/models/blog.types';

@ObjectType('BlogPost', { description: '文章' })
export class BlogPostObjectType {
  @Field(() => ID, { description: '文章 ID' })
  id!: number;

  @Field(() => String, { description: '标题' })
  title!: string;

  @Field(() => String, { description: 'URL slug' })
  slug!: string;

  @Field(() => String, { description: '摘要', nullable: true })
  excerpt!: string | null;

  @Field(() => String, { description: '封面图 URL', nullable: true })
  coverImage!: string | null;

  @Field(() => BlogPostStatus, { description: '文章状态' })
  status!: BlogPostStatus;

  @Field(() => Int, { description: '分类 ID', nullable: true })
  categoryId!: number | null;

  @Field(() => String, { description: '分类名称', nullable: true })
  categoryName!: string | null;

  @Field(() => [Int], { description: '标签 ID 列表' })
  tagIds!: readonly number[];

  @Field(() => Int, { description: '浏览数' })
  viewCount!: number;

  @Field(() => Int, { description: '点赞数' })
  likeCount!: number;

  @Field(() => Int, { description: '评论数' })
  commentCount!: number;

  @Field(() => Boolean, { description: '是否置顶' })
  isPinned!: boolean;

  @Field(() => Date, { description: '发布时间', nullable: true })
  publishedAt!: Date | null;

  @Field(() => Date, { description: '删除时间', nullable: true })
  deletedAt!: Date | null;

  @Field(() => Date, { description: '创建时间' })
  createdAt!: Date;

  @Field(() => Date, { description: '更新时间' })
  updatedAt!: Date;
}
