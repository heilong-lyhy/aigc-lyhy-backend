// src/adapters/api/graphql/blog/blog-tag.resolver.ts
// 标签 GraphQL Resolver：输入解析、权限接入与输出封装

import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';
import { CreateBlogTagUsecase } from '@src/usecases/blog/create-blog-tag.usecase';
import { DeleteBlogTagUsecase } from '@src/usecases/blog/delete-blog-tag.usecase';
import { UpdateBlogTagUsecase } from '@src/usecases/blog/update-blog-tag.usecase';
import { ListBlogTagsUsecase } from '@src/usecases/blog/blog-read.usecase';
import { BlogTagObjectType } from './dto/blog-tag.dto';
import { UpdateBlogTagInput } from './dto/update-blog-tag.input';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Resolver()
export class BlogTagResolver {
  constructor(
    private readonly listBlogTagsUsecase: ListBlogTagsUsecase,
    private readonly createBlogTagUsecase: CreateBlogTagUsecase,
    private readonly updateBlogTagUsecase: UpdateBlogTagUsecase,
    private readonly deleteBlogTagUsecase: DeleteBlogTagUsecase,
  ) {}

  // ─── 公开查询 ───

  @Query(() => [BlogTagObjectType], { description: '查询所有标签' })
  async blogTags(): Promise<BlogTagObjectType[]> {
    return this.listBlogTagsUsecase.execute();
  }

  // ─── 管理端 Mutation ───

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => BlogTagObjectType, { description: '创建标签' })
  async createBlogTag(
    @Args('name', { type: () => String, description: '标签名称' }) name: string,
    @Args('slug', { type: () => String, description: 'URL slug' }) slug: string,
  ): Promise<BlogTagObjectType> {
    const { tag } = await this.createBlogTagUsecase.execute({ name, slug });
    return tag;
  }

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => BlogTagObjectType, { description: '更新标签' })
  async updateBlogTag(@Args('input') input: UpdateBlogTagInput): Promise<BlogTagObjectType> {
    const { tag } = await this.updateBlogTagUsecase.execute(input.id, {
      name: input.name,
      slug: input.slug,
    });
    return tag;
  }

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => Boolean, { description: '删除标签' })
  async deleteBlogTag(
    @Args('id', { type: () => Int, description: '标签 ID' }) id: number,
  ): Promise<boolean> {
    const { deleted } = await this.deleteBlogTagUsecase.execute(id);
    return deleted;
  }
}
