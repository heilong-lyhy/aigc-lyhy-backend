// src/adapters/api/graphql/blog/dto/blog-category.dto.ts
// 分类 ObjectType：薄映射 BlogCategoryView

import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('BlogCategory', { description: '分类' })
export class BlogCategoryObjectType {
  @Field(() => ID, { description: '分类 ID' })
  id!: number;

  @Field(() => String, { description: '分类名称' })
  name!: string;

  @Field(() => String, { description: 'URL slug' })
  slug!: string;

  @Field(() => String, { description: '描述', nullable: true })
  description!: string | null;

  @Field(() => Int, { description: '父级分类 ID', nullable: true })
  parentId!: number | null;

  @Field(() => Int, { description: '排序序号' })
  sortOrder!: number;

  @Field(() => Int, { description: '文章数' })
  postCount!: number;

  @Field(() => Date, { description: '创建时间' })
  createdAt!: Date;

  @Field(() => Date, { description: '更新时间' })
  updatedAt!: Date;
}
