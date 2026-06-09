// src/adapters/api/graphql/blog/blog-post.resolver.ts
// 文章 GraphQL Resolver：输入解析、权限接入与输出封装

import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';
import { CreateBlogPostUsecase } from '@src/usecases/blog/create-blog-post.usecase';
import { UpdateBlogPostUsecase } from '@src/usecases/blog/update-blog-post.usecase';
import { DeleteBlogPostUsecase } from '@src/usecases/blog/delete-blog-post.usecase';
import { PublishBlogPostUsecase } from '@src/usecases/blog/publish-blog-post.usecase';
import {
  GetBlogPostByIdUsecase,
  GetBlogPostBySlugUsecase,
  ListBlogPostsUsecase,
  ListBlogPublishedPostsUsecase,
} from '@src/usecases/blog/blog-read.usecase';
import { BlogPostDetailObjectType } from './dto/blog-post-detail.dto';
import { BlogPostsListResponse } from './dto/blog-posts.list';
import { BlogPostArgs } from './dto/blog-post.args';
import { BlogPostsArgs } from './dto/blog-posts.args';
import { CreateBlogPostInput } from './dto/create-blog-post.input';
import { UpdateBlogPostInput } from './dto/update-blog-post.input';
import { BlogPublishedPostsArgs } from './dto/blog-published-posts.args';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Resolver()
export class BlogPostResolver {
  constructor(
    private readonly getBlogPostByIdUsecase: GetBlogPostByIdUsecase,
    private readonly getBlogPostBySlugUsecase: GetBlogPostBySlugUsecase,
    private readonly listBlogPostsUsecase: ListBlogPostsUsecase,
    private readonly listBlogPublishedPostsUsecase: ListBlogPublishedPostsUsecase,
    private readonly createBlogPostUsecase: CreateBlogPostUsecase,
    private readonly updateBlogPostUsecase: UpdateBlogPostUsecase,
    private readonly deleteBlogPostUsecase: DeleteBlogPostUsecase,
    private readonly publishBlogPostUsecase: PublishBlogPostUsecase,
  ) {}

  // ─── 公开查询 ───

  @Query(() => BlogPostDetailObjectType, { description: '按 ID 查询文章详情', nullable: true })
  async blogPost(@Args() args: BlogPostArgs): Promise<BlogPostDetailObjectType | null> {
    return this.getBlogPostByIdUsecase.execute(args.id, { publishedOnly: true });
  }

  @Query(() => BlogPostDetailObjectType, { description: '按 slug 查询文章详情', nullable: true })
  async blogPostBySlug(
    @Args('slug', { type: () => String, description: 'URL slug' }) slug: string,
  ): Promise<BlogPostDetailObjectType | null> {
    return this.getBlogPostBySlugUsecase.execute(slug, { publishedOnly: true });
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
}
