// src/adapters/api/graphql/blog/dto/blog-dashboard.dto.ts
// 仪表盘统计 ObjectType：薄映射 BlogDashboardView

import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('BlogDashboard', { description: '博客仪表盘统计' })
export class BlogDashboardObjectType {
  @Field(() => Int, { description: '文章总数' })
  totalPosts!: number;

  @Field(() => Int, { description: '已发布文章数' })
  publishedPosts!: number;

  @Field(() => Int, { description: '草稿文章数' })
  draftPosts!: number;

  @Field(() => Int, { description: '分类总数' })
  totalCategories!: number;

  @Field(() => Int, { description: '标签总数' })
  totalTags!: number;

  @Field(() => Int, { description: '评论总数' })
  totalComments!: number;

  @Field(() => Int, { description: '待审核评论数' })
  pendingComments!: number;

  @Field(() => Int, { description: '点赞总数' })
  totalLikes!: number;

  @Field(() => Int, { description: '浏览总数' })
  totalViews!: number;
}
