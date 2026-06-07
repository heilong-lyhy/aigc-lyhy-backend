// src/adapters/api/graphql/blog/dto/blog-files.list.ts
// 文件列表响应

import { Field, Int, ObjectType } from '@nestjs/graphql';
import { BlogFileObjectType } from './blog-file.dto';

@ObjectType({ description: '文件列表' })
export class BlogFilesListResponse {
  @Field(() => [BlogFileObjectType], { description: '文件列表' })
  list!: BlogFileObjectType[];

  @Field(() => Int, { description: '当前页码' })
  current!: number;

  @Field(() => Int, { description: '每页数量' })
  pageSize!: number;

  @Field(() => Int, { description: '总数量' })
  total!: number;
}
