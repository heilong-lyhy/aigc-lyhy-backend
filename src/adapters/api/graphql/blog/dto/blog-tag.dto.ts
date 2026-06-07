// src/adapters/api/graphql/blog/dto/blog-tag.dto.ts
// 标签 ObjectType：薄映射 BlogTagView

import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: '标签' })
export class BlogTagObjectType {
  @Field(() => ID, { description: '标签 ID' })
  id!: number;

  @Field(() => String, { description: '标签名称' })
  name!: string;

  @Field(() => String, { description: 'URL slug' })
  slug!: string;

  @Field(() => Int, { description: '文章数' })
  postCount!: number;

  @Field(() => Date, { description: '创建时间' })
  createdAt!: Date;

  @Field(() => Date, { description: '更新时间' })
  updatedAt!: Date;
}
