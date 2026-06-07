// src/adapters/api/graphql/blog/blog-category.resolver.ts
// 分类 GraphQL Resolver：输入解析、权限接入与输出封装

import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CreateBlogCategoryUsecase } from '@src/usecases/blog/create-blog-category.usecase';
import { UpdateBlogCategoryUsecase } from '@src/usecases/blog/update-blog-category.usecase';
import { DeleteBlogCategoryUsecase } from '@src/usecases/blog/delete-blog-category.usecase';
import {
  ListBlogCategoriesUsecase,
  GetBlogCategoryTreeUsecase,
} from '@src/usecases/blog/blog-read.usecase';
import { BlogCategoryObjectType } from './dto/blog-category.dto';
import { CreateBlogCategoryInput } from './dto/create-blog-category.input';
import { UpdateBlogCategoryInput } from './dto/update-blog-category.input';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Resolver()
export class BlogCategoryResolver {
  constructor(
    private readonly listBlogCategoriesUsecase: ListBlogCategoriesUsecase,
    private readonly getBlogCategoryTreeUsecase: GetBlogCategoryTreeUsecase,
    private readonly createBlogCategoryUsecase: CreateBlogCategoryUsecase,
    private readonly updateBlogCategoryUsecase: UpdateBlogCategoryUsecase,
    private readonly deleteBlogCategoryUsecase: DeleteBlogCategoryUsecase,
  ) {}

  // ─── 公开查询 ───

  @Query(() => [BlogCategoryObjectType], { description: '查询所有分类' })
  async blogCategories(): Promise<BlogCategoryObjectType[]> {
    return this.listBlogCategoriesUsecase.execute();
  }

  @Query(() => [BlogCategoryObjectType], { description: '查询分类树' })
  async blogCategoryTree(): Promise<BlogCategoryObjectType[]> {
    return this.getBlogCategoryTreeUsecase.execute();
  }

  // ─── 管理端 Mutation ───

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => BlogCategoryObjectType, { description: '创建分类' })
  async createBlogCategory(
    @Args('input') input: CreateBlogCategoryInput,
  ): Promise<BlogCategoryObjectType> {
    const { category } = await this.createBlogCategoryUsecase.execute({
      name: input.name,
      slug: input.slug,
      description: input.description,
      parentId: input.parentId,
      sortOrder: input.sortOrder,
    });
    return category;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => BlogCategoryObjectType, { description: '更新分类' })
  async updateBlogCategory(
    @Args('input') input: UpdateBlogCategoryInput,
  ): Promise<BlogCategoryObjectType> {
    const { category } = await this.updateBlogCategoryUsecase.execute(input.id, {
      name: input.name,
      slug: input.slug,
      description: input.description,
      parentId: input.parentId,
      sortOrder: input.sortOrder,
    });
    return category;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => Boolean, { description: '删除分类' })
  async deleteBlogCategory(
    @Args('id', { type: () => Int, description: '分类 ID' }) id: number,
  ): Promise<boolean> {
    const { deleted } = await this.deleteBlogCategoryUsecase.execute(id);
    return deleted;
  }
}
