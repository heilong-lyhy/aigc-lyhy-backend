// src/adapters/api/graphql/blog/dto/create-blog-category.input.ts
// 创建分类输入

import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

@InputType({ description: '创建分类输入' })
export class CreateBlogCategoryInput {
  @Field(() => String, { description: '分类名称' })
  @IsString({ message: '分类名称必须是字符串' })
  @IsNotEmpty({ message: '分类名称不能为空' })
  @MinLength(1, { message: '分类名称至少 1 个字符' })
  name!: string;

  @Field(() => String, { description: 'URL slug' })
  @IsString({ message: 'slug 必须是字符串' })
  @IsNotEmpty({ message: 'slug 不能为空' })
  slug!: string;

  @Field(() => String, { description: '描述', nullable: true })
  @IsOptional()
  @IsString({ message: '描述必须是字符串' })
  description?: string;

  @Field(() => Int, { description: '父级分类 ID', nullable: true })
  @IsOptional()
  @IsInt({ message: '父级分类 ID 必须是整数' })
  parentId?: number;

  @Field(() => Int, { description: '排序序号', nullable: true })
  @IsOptional()
  @IsInt({ message: '排序序号必须是整数' })
  sortOrder?: number;
}
