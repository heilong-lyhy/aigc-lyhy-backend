// src/adapters/api/graphql/blog/dto/update-blog-friend-link.input.ts
// 更新友情链接输入

import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl } from 'class-validator';

@InputType({ description: '更新友情链接输入' })
export class UpdateBlogFriendLinkInput {
  @Field(() => ID, { description: '友链 ID' })
  @IsInt({ message: '友链 ID 必须是整数' })
  id!: number;

  @Field(() => String, { description: '站点名称', nullable: true })
  @IsOptional()
  @IsString({ message: '站点名称必须是字符串' })
  name?: string;

  @Field(() => String, { description: '站点 URL', nullable: true })
  @IsOptional()
  @IsUrl({}, { message: '站点 URL 格式不正确' })
  url?: string;

  @Field(() => String, { description: '站点描述', nullable: true })
  @IsOptional()
  @IsString({ message: '站点描述必须是字符串' })
  description?: string | null;

  @Field(() => String, { description: 'Logo URL', nullable: true })
  @IsOptional()
  @IsUrl({}, { message: 'Logo URL 格式不正确' })
  logoUrl?: string | null;

  @Field(() => Int, { description: '排序序号', nullable: true })
  @IsOptional()
  @IsInt({ message: '排序序号必须是整数' })
  sortOrder?: number;

  @Field(() => Boolean, { description: '是否启用', nullable: true })
  @IsOptional()
  @IsBoolean({ message: '是否启用必须是布尔值' })
  isActive?: boolean;
}
