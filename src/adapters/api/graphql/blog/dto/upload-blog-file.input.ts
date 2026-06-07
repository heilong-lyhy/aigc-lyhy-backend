// src/adapters/api/graphql/blog/dto/upload-blog-file.input.ts
// 文件上传输入：file 字段使用 Upload 标量，其余为元数据

import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsOptional } from 'class-validator';
import { BlogFileType } from '@app-types/models/blog.types';
import { GraphQLUpload } from '@src/adapters/api/graphql/schema/upload.scalar';
import type { FileUpload } from 'graphql-upload/processRequest.mjs';

@InputType({ description: '文件上传输入' })
export class UploadBlogFileInput {
  @Field(() => GraphQLUpload, { description: '上传文件（Upload 标量）' })
  file!: Promise<FileUpload>;

  @Field(() => BlogFileType, { description: '文件类型', nullable: true })
  @IsOptional()
  @IsEnum(BlogFileType, { message: '文件类型无效' })
  fileType?: BlogFileType;
}
