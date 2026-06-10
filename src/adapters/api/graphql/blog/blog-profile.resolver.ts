// src/adapters/api/graphql/blog/blog-profile.resolver.ts
// 博主信息 GraphQL Resolver：输入解析、权限接入与输出封装

import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtPayload } from '@app-types/jwt.types';
import { UpdateBlogProfileUsecase } from '@usecases/blog/update-blog-profile.usecase';
import { ChangeBlogAdminPasswordUsecase } from '@usecases/blog/change-blog-admin-password.usecase';
import { GetBlogProfileUsecase } from '@usecases/blog/blog-read.usecase';
import { BlogProfileObjectType } from './dto/blog-profile.dto';
import { UpdateBlogProfileInput } from './dto/update-blog-profile.input';
import { ChangeBlogAdminPasswordInput } from './dto/change-blog-admin-password.input';
import { currentUser } from '@adapters/api/graphql/decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Resolver()
export class BlogProfileResolver {
  constructor(
    private readonly getBlogProfileUsecase: GetBlogProfileUsecase,
    private readonly updateBlogProfileUsecase: UpdateBlogProfileUsecase,
    private readonly changeBlogAdminPasswordUsecase: ChangeBlogAdminPasswordUsecase,
  ) {}

  // ─── 公开查询 ───

  @Query(() => BlogProfileObjectType, { description: '查询博主信息', nullable: true })
  async blogProfile(): Promise<BlogProfileObjectType | null> {
    return this.getBlogProfileUsecase.execute();
  }

  // ─── 管理端 Mutation ───

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => BlogProfileObjectType, { description: '更新博主信息' })
  async updateBlogProfile(
    @Args('input') input: UpdateBlogProfileInput,
  ): Promise<BlogProfileObjectType> {
    const { profile } = await this.updateBlogProfileUsecase.execute({
      nickname: input.nickname,
      bio: input.bio,
      avatarUrl: input.avatarUrl,
      socialLinks: input.socialLinks,
    });
    return profile;
  }

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => Int, { description: '修改博客管理员密码' })
  async changeBlogAdminPassword(
    @currentUser() user: JwtPayload,
    @Args('input') input: ChangeBlogAdminPasswordInput,
  ): Promise<number> {
    const { accountId } = await this.changeBlogAdminPasswordUsecase.execute({
      accountId: user.sub,
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    });
    return accountId;
  }
}
