// src/adapters/api/graphql/blog/blog-post.resolver.ts
// 文章 GraphQL Resolver：输入解析、权限接入与输出封装

import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';
import { CreateBlogPostUsecase } from '@usecases/blog/create-blog-post.usecase';
import { UpdateBlogPostUsecase } from '@usecases/blog/update-blog-post.usecase';
import { DeleteBlogPostUsecase } from '@usecases/blog/delete-blog-post.usecase';
import { PublishBlogPostUsecase } from '@usecases/blog/publish-blog-post.usecase';
import { RestoreBlogPostUsecase } from '@usecases/blog/restore-blog-post.usecase';
import { PermanentDeleteBlogPostUsecase } from '@usecases/blog/permanent-delete-blog-post.usecase';
import { ListDeletedBlogPostsUsecase } from '@usecases/blog/list-deleted-blog-posts.usecase';
import {
  ListBlogPostsUsecase,
  ListBlogPublishedPostsUsecase,
} from '@usecases/blog/blog-read.usecase';
import { ViewBlogPostUsecase } from '@usecases/blog/view-blog-post.usecase';
import { BlogPostDetailObjectType } from './dto/blog-post-detail.dto';
import { BlogPostsListResponse } from './dto/blog-posts.list';
import { BlogPostArgs } from './dto/blog-post.args';
import { BlogPostsArgs } from './dto/blog-posts.args';
import { BlogDeletedPostsArgs } from './dto/blog-deleted-posts.args';
import { CreateBlogPostInput } from './dto/create-blog-post.input';
import { UpdateBlogPostInput } from './dto/update-blog-post.input';
import { BlogPublishedPostsArgs } from './dto/blog-published-posts.args';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Resolver()
export class BlogPostResolver {
  constructor(
    private readonly viewBlogPostUsecase: ViewBlogPostUsecase,
    private readonly listBlogPostsUsecase: ListBlogPostsUsecase,
    private readonly listBlogPublishedPostsUsecase: ListBlogPublishedPostsUsecase,
    private readonly createBlogPostUsecase: CreateBlogPostUsecase,
    private readonly updateBlogPostUsecase: UpdateBlogPostUsecase,
    private readonly deleteBlogPostUsecase: DeleteBlogPostUsecase,
    private readonly publishBlogPostUsecase: PublishBlogPostUsecase,
    private readonly restoreBlogPostUsecase: RestoreBlogPostUsecase,
    private readonly permanentDeleteBlogPostUsecase: PermanentDeleteBlogPostUsecase,
    private readonly listDeletedBlogPostsUsecase: ListDeletedBlogPostsUsecase,
  ) {}

  // ─── 公开查询 ───

  @Query(() => BlogPostDetailObjectType, { description: '按 ID 查询文章详情', nullable: true })
  async blogPost(@Args() args: BlogPostArgs): Promise<BlogPostDetailObjectType | null> {
    return this.viewBlogPostUsecase.viewById(args.id);
  }

  @Query(() => BlogPostDetailObjectType, { description: '按 slug 查询文章详情', nullable: true })
  async blogPostBySlug(
    @Args('slug', { type: () => String, description: 'URL slug' }) slug: string,
  ): Promise<BlogPostDetailObjectType | null> {
    return this.viewBlogPostUsecase.viewBySlug(slug);
  }

  @Query(() => BlogPostsListResponse, { description: '查询已发布文章列表（公开）' })
  async blogPublishedPosts(@Args() args: BlogPublishedPostsArgs): Promise<BlogPostsListResponse> {
    const result = await this.listBlogPublishedPostsUsecase.execute({
      page: args.page,
      pageSize: args.limit,
      sortBy: args.sortBy,
      sortOrder: args.sortOrder,
      categoryId: args.categoryId,
      title: args.title,
      tagId: args.tagId,
    });
    return {
      list: [...result.items],
      current: result.page ?? args.page,
      pageSize: result.pageSize ?? args.limit,
      total: result.total ?? 0,
    };
  }

  // ─── 管理端查询 ───

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Query(() => BlogPostsListResponse, { description: '查询文章列表（管理端，支持筛选）' })
  async blogPosts(@Args() args: BlogPostsArgs): Promise<BlogPostsListResponse> {
    const result = await this.listBlogPostsUsecase.execute({
      page: args.page,
      pageSize: args.limit,
      sortBy: args.sortBy,
      sortOrder: args.sortOrder,
      status: args.status,
      categoryId: args.categoryId,
      title: args.title,
    });
    return {
      list: [...result.items],
      current: result.page ?? args.page,
      pageSize: result.pageSize ?? args.limit,
      total: result.total ?? 0,
    };
  }

  // ─── 管理端 Mutation ───

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => BlogPostDetailObjectType, { description: '创建文章' })
  async createBlogPost(
    @Args('input') input: CreateBlogPostInput,
  ): Promise<BlogPostDetailObjectType> {
    const { post } = await this.createBlogPostUsecase.execute({
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt,
      content: input.content,
      renderedContent: input.renderedContent,
      coverImage: input.coverImage,
      status: input.status,
      categoryId: input.categoryId,
      tagIds: input.tagIds,
      isPinned: input.isPinned,
      publishedAt: input.publishedAt,
    });
    return post;
  }

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => BlogPostDetailObjectType, { description: '更新文章' })
  async updateBlogPost(
    @Args('input') input: UpdateBlogPostInput,
  ): Promise<BlogPostDetailObjectType> {
    const { post } = await this.updateBlogPostUsecase.execute(input.id, {
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt,
      content: input.content,
      renderedContent: input.renderedContent,
      coverImage: input.coverImage,
      status: input.status,
      categoryId: input.categoryId,
      tagIds: input.tagIds,
      isPinned: input.isPinned,
      publishedAt: input.publishedAt,
    });
    return post;
  }

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => Boolean, { description: '删除文章' })
  async deleteBlogPost(
    @Args('id', { type: () => Int, description: '文章 ID' }) id: number,
  ): Promise<boolean> {
    const { deleted } = await this.deleteBlogPostUsecase.execute(id);
    return deleted;
  }

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => BlogPostDetailObjectType, { description: '发布文章' })
  async publishBlogPost(
    @Args('id', { type: () => Int, description: '文章 ID' }) id: number,
  ): Promise<BlogPostDetailObjectType> {
    const { post } = await this.publishBlogPostUsecase.execute(id);
    return post;
  }

  // ─── 管理端回收站 ───

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Query(() => BlogPostsListResponse, { description: '查询已删除文章列表（回收站）' })
  async blogDeletedPosts(@Args() args: BlogDeletedPostsArgs): Promise<BlogPostsListResponse> {
    const result = await this.listDeletedBlogPostsUsecase.execute({
      page: args.page,
      pageSize: args.limit,
      sortBy: args.sortBy,
      sortOrder: args.sortOrder,
      categoryId: args.categoryId,
      title: args.title,
    });
    return {
      list: [...result.items],
      current: result.page ?? args.page,
      pageSize: result.pageSize ?? args.limit,
      total: result.total ?? 0,
    };
  }

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => BlogPostDetailObjectType, { description: '恢复已删除文章' })
  async restoreBlogPost(
    @Args('id', { type: () => Int, description: '文章 ID' }) id: number,
  ): Promise<BlogPostDetailObjectType> {
    const { post } = await this.restoreBlogPostUsecase.execute(id);
    return post;
  }

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => Boolean, { description: '永久删除文章' })
  async permanentDeleteBlogPost(
    @Args('id', { type: () => Int, description: '文章 ID' }) id: number,
  ): Promise<boolean> {
    const { deleted } = await this.permanentDeleteBlogPostUsecase.execute(id);
    return deleted;
  }
}
