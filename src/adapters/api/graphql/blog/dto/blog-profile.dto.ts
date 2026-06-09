// src/adapters/api/graphql/blog/dto/blog-profile.dto.ts
// 博主信息 ObjectType：薄映射 BlogProfileView

import { Field, ID, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType('BlogProfile', { description: '博主信息' })
export class BlogProfileObjectType {
  @Field(() => ID, { description: '博主信息 ID' })
  id!: number;

  @Field(() => String, { description: '昵称' })
  nickname!: string;

  @Field(() => String, { description: '简介', nullable: true })
  bio!: string | null;

  @Field(() => String, { description: '头像 URL', nullable: true })
  avatarUrl!: string | null;

  @Field(() => GraphQLJSON, { description: '社交链接', nullable: true })
  socialLinks!: Record<string, string> | null;

  @Field(() => Date, { description: '创建时间' })
  createdAt!: Date;

  @Field(() => Date, { description: '更新时间' })
  updatedAt!: Date;
}
