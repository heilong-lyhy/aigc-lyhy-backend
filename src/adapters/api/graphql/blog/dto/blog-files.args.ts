// src/adapters/api/graphql/blog/dto/blog-files.args.ts
// 文件列表查询参数：按文件类型筛选 + 通用分页

import { ArgsType, Field } from '@nestjs/graphql';
import { IsEnum, IsOptional } from 'class-validator';
import { BlogFileType } from '@app-types/models/blog.types';
import { BlogPaginationArgs } from './blog-pagination.args';

@ArgsType()
export class BlogFilesArgs extends BlogPaginationArgs {
  @Field(() => BlogFileType, { description: '按文件类型筛选', nullable: true })
  @IsOptional()
  @IsEnum(BlogFileType, { message: '文件类型无效' })
  fileType?: BlogFileType;
}
