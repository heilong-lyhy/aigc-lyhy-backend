// src/adapters/api/graphql/blog/dto/update-blog-category.input.ts
// 更新分类输入
// - 字段省略或 undefined 表示不修改
// - 显式传 null 表示清空（仅对 description / parentId 有效）

import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

@InputType({ description: '更新分类输入' })
export class UpdateBlogCategoryInput {
  @Field(() => Int, { description: '分类 ID' })
  @IsInt({ message: '分类 ID 必须是整数' })
  id!: number;

  @Field(() => String, { description: '分类名称', nullable: true })
  @IsOptional()
  @IsString({ message: '分类名称必须是字符串' })
  @MinLength(1, { message: '分类名称至少 1 个字符' })
  @MaxLength(100, { message: '分类名称最多 100 个字符' })
  name?: string;

  @Field(() => String, { description: 'URL slug', nullable: true })
  @IsOptional()
  @IsString({ message: 'slug 必须是字符串' })
  @MaxLength(100, { message: 'slug 最多 100 个字符' })
  slug?: string;

  @Field(() => String, { description: '描述（传 null 清空）', nullable: true })
  @IsOptional()
  @IsString({ message: '描述必须是字符串' })
  @MaxLength(512, { message: '描述最多 512 个字符' })
  description?: string | null;

  @Field(() => Int, { description: '父级分类 ID（传 null 清空）', nullable: true })
  @IsOptional()
  @IsInt({ message: '父级分类 ID 必须是整数' })
  parentId?: number | null;

  @Field(() => Int, { description: '排序序号', nullable: true })
  @IsOptional()
  @IsInt({ message: '排序序号必须是整数' })
  sortOrder?: number;
}
