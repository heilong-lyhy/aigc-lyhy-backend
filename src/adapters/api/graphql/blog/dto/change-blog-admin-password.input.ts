// src/adapters/api/graphql/blog/dto/change-blog-admin-password.input.ts
// 博客管理员密码修改输入
// accountId 从认证上下文获取，不暴露给客户端

import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { IsValidPassword } from '@adapters/api/graphql/common/password-validation.decorator';

@InputType({ description: '博客管理员密码修改输入' })
export class ChangeBlogAdminPasswordInput {
  @Field(() => String, { description: '当前密码' })
  @IsString({ message: '当前密码必须是字符串' })
  @IsNotEmpty({ message: '当前密码不能为空' })
  currentPassword!: string;

  @Field(() => String, { description: '新密码' })
  @IsString({ message: '新密码必须是字符串' })
  @IsNotEmpty({ message: '新密码不能为空' })
  @MinLength(6, { message: '新密码至少 6 个字符' })
  @IsValidPassword({ message: '新密码不符合安全要求' })
  newPassword!: string;
}
