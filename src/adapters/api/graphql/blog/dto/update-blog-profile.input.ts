// src/adapters/api/graphql/blog/dto/update-blog-profile.input.ts
// 更新博主信息输入
// - 字段省略或 undefined 表示不修改
// - 显式传 null 表示清空（仅对 bio / avatarUrl / socialLinks 有效）
// - id 从认证上下文获取，不暴露给客户端

import { Field, InputType } from '@nestjs/graphql';
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';

@InputType({ description: '更新博主信息输入' })
export class UpdateBlogProfileInput {
  @Field(() => String, { description: '昵称', nullable: true })
  @IsOptional()
  @IsString({ message: '昵称必须是字符串' })
  @MinLength(1, { message: '昵称至少 1 个字符' })
  @MaxLength(50, { message: '昵称不能超过 50 个字符' })
  nickname?: string;

  @Field(() => String, { description: '简介（传 null 清空）', nullable: true })
  @IsOptional()
  @IsString({ message: '简介必须是字符串' })
  @MaxLength(500, { message: '简介不能超过 500 个字符' })
  bio?: string | null;

  @Field(() => String, { description: '头像 URL（传 null 清空）', nullable: true })
  @IsOptional()
  @IsString({ message: '头像 URL 必须是字符串' })
  @MaxLength(500, { message: '头像 URL 不能超过 500 个字符' })
  avatarUrl?: string | null;

  @Field(() => GraphQLJSON, { description: '社交链接（传 null 清空）', nullable: true })
  @IsOptional()
  @IsObject({ message: '社交链接必须是对象' })
  socialLinks?: Record<string, string> | null;
}
