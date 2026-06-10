// src/adapters/api/graphql/blog/dto/create-blog-friend-link.input.ts
// 创建友情链接输入

import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

@InputType({ description: '创建友情链接输入' })
export class CreateBlogFriendLinkInput {
  @Field(() => String, { description: '站点名称' })
  @IsString({ message: '站点名称必须是字符串' })
  @MinLength(1, { message: '站点名称至少 1 个字符' })
  name!: string;

  @Field(() => String, { description: '站点 URL' })
  @IsUrl({}, { message: '站点 URL 格式不正确' })
  @IsNotEmpty({ message: '站点 URL 不能为空' })
  url!: string;

  @Field(() => String, { description: '站点描述', nullable: true })
  @IsOptional()
  @IsString({ message: '站点描述必须是字符串' })
  description?: string;

  @Field(() => String, { description: 'Logo URL', nullable: true })
  @IsOptional()
  @IsUrl({}, { message: 'Logo URL 格式不正确' })
  logoUrl?: string;

  @Field(() => Int, { description: '排序序号', nullable: true })
  @IsOptional()
  @IsInt({ message: '排序序号必须是整数' })
  sortOrder?: number;

  @Field(() => Boolean, { description: '是否启用', nullable: true })
  @IsOptional()
  @IsBoolean({ message: '是否启用必须是布尔值' })
  isActive?: boolean;
}
