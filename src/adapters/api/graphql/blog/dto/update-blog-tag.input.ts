// src/adapters/api/graphql/blog/dto/update-blog-tag.input.ts
// 更新标签输入
// - 字段省略或 undefined 表示不修改

import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

@InputType({ description: '更新标签输入' })
export class UpdateBlogTagInput {
  @Field(() => Int, { description: '标签 ID' })
  @IsInt({ message: '标签 ID 必须是整数' })
  id!: number;

  @Field(() => String, { description: '标签名称', nullable: true })
  @IsOptional()
  @IsString({ message: '标签名称必须是字符串' })
  @MinLength(1, { message: '标签名称至少 1 个字符' })
  @MaxLength(100, { message: '标签名称最多 100 个字符' })
  name?: string;

  @Field(() => String, { description: 'URL slug', nullable: true })
  @IsOptional()
  @IsString({ message: 'slug 必须是字符串' })
  @MaxLength(100, { message: 'slug 最多 100 个字符' })
  slug?: string;
}
