// src/adapters/api/graphql/blog/dto/blog-file.dto.ts
// 文件 ObjectType：薄映射 BlogFileView

import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { BlogFileType } from '@app-types/models/blog.types';

@ObjectType('BlogFile', { description: '博客文件' })
export class BlogFileObjectType {
  @Field(() => ID, { description: '文件 ID' })
  id!: number;

  @Field(() => String, { description: '原始文件名' })
  originalName!: string;

  @Field(() => String, { description: '存储文件名' })
  storedName!: string;

  @Field(() => String, { description: 'MIME 类型' })
  mimeType!: string;

  @Field(() => Int, { description: '文件大小（字节）' })
  fileSize!: number;

  @Field(() => String, { description: '存储路径' })
  storagePath!: string;

  @Field(() => BlogFileType, { description: '文件类型' })
  fileType!: BlogFileType;

  @Field(() => Date, { description: '创建时间' })
  createdAt!: Date;

  @Field(() => Date, { description: '更新时间' })
  updatedAt!: Date;
}
