// src/adapters/api/graphql/blog/dto/blog-friend-link.dto.ts
// 友情链接 ObjectType：薄映射 BlogFriendLinkView

import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('BlogFriendLink', { description: '友情链接' })
export class BlogFriendLinkObjectType {
  @Field(() => ID, { description: '友链 ID' })
  id!: number;

  @Field(() => String, { description: '站点名称' })
  name!: string;

  @Field(() => String, { description: '站点 URL' })
  url!: string;

  @Field(() => String, { description: '站点描述', nullable: true })
  description!: string | null;

  @Field(() => String, { description: 'Logo URL', nullable: true })
  logoUrl!: string | null;

  @Field(() => Int, { description: '排序序号' })
  sortOrder!: number;

  @Field(() => Boolean, { description: '是否启用' })
  isActive!: boolean;

  @Field(() => Date, { description: '创建时间' })
  createdAt!: Date;

  @Field(() => Date, { description: '更新时间' })
  updatedAt!: Date;
}
