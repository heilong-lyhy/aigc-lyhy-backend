// src/adapters/api/graphql/blog/blog-friend-link.resolver.ts
// 友情链接 GraphQL Resolver：输入解析、权限接入与输出封装

import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ListBlogFriendLinksUsecase,
  ListAllBlogFriendLinksUsecase,
} from '@usecases/blog/blog-read.usecase';
import { CreateBlogFriendLinkUsecase } from '@usecases/blog/create-blog-friend-link.usecase';
import { UpdateBlogFriendLinkUsecase } from '@usecases/blog/update-blog-friend-link.usecase';
import { DeleteBlogFriendLinkUsecase } from '@usecases/blog/delete-blog-friend-link.usecase';
import { BlogFriendLinkObjectType } from './dto/blog-friend-link.dto';
import { CreateBlogFriendLinkInput } from './dto/create-blog-friend-link.input';
import { UpdateBlogFriendLinkInput } from './dto/update-blog-friend-link.input';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Resolver()
export class BlogFriendLinkResolver {
  constructor(
    private readonly listBlogFriendLinksUsecase: ListBlogFriendLinksUsecase,
    private readonly listAllBlogFriendLinksUsecase: ListAllBlogFriendLinksUsecase,
    private readonly createBlogFriendLinkUsecase: CreateBlogFriendLinkUsecase,
    private readonly updateBlogFriendLinkUsecase: UpdateBlogFriendLinkUsecase,
    private readonly deleteBlogFriendLinkUsecase: DeleteBlogFriendLinkUsecase,
  ) {}

  // ─── 公开查询 ───

  @Query(() => [BlogFriendLinkObjectType], { description: '查询启用的友情链接列表' })
  async blogFriendLinks(): Promise<BlogFriendLinkObjectType[]> {
    return this.listBlogFriendLinksUsecase.execute();
  }

  // ─── 管理端查询 ───

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Query(() => [BlogFriendLinkObjectType], { description: '查询所有友情链接（含禁用项）' })
  async blogAllFriendLinks(): Promise<BlogFriendLinkObjectType[]> {
    return this.listAllBlogFriendLinksUsecase.execute();
  }

  // ─── 管理端 Mutation ───

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => BlogFriendLinkObjectType, { description: '创建友情链接' })
  async createBlogFriendLink(
    @Args('input') input: CreateBlogFriendLinkInput,
  ): Promise<BlogFriendLinkObjectType> {
    const { friendLink } = await this.createBlogFriendLinkUsecase.execute({
      name: input.name,
      url: input.url,
      description: input.description,
      logoUrl: input.logoUrl,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    });
    return friendLink;
  }

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => BlogFriendLinkObjectType, { description: '更新友情链接' })
  async updateBlogFriendLink(
    @Args('input') input: UpdateBlogFriendLinkInput,
  ): Promise<BlogFriendLinkObjectType> {
    const { friendLink } = await this.updateBlogFriendLinkUsecase.execute({
      id: input.id,
      name: input.name,
      url: input.url,
      description: input.description,
      logoUrl: input.logoUrl,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    });
    return friendLink;
  }

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => Boolean, { description: '删除友情链接' })
  async deleteBlogFriendLink(
    @Args('id', { type: () => Int, description: '友链 ID' }) id: number,
  ): Promise<boolean> {
    const { deleted } = await this.deleteBlogFriendLinkUsecase.execute(id);
    return deleted;
  }
}
