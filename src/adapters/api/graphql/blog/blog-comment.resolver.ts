// src/adapters/api/graphql/blog/blog-comment.resolver.ts
// 评论 GraphQL Resolver：输入解析、权限接入与输出封装

import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { CreateBlogCommentUsecase } from '@src/usecases/blog/create-blog-comment.usecase';
import { UpdateBlogCommentStatusUsecase } from '@src/usecases/blog/update-blog-comment-status.usecase';
import { BatchUpdateBlogCommentStatusUsecase } from '@src/usecases/blog/batch-update-blog-comment-status.usecase';
import { DeleteBlogCommentUsecase } from '@src/usecases/blog/delete-blog-comment.usecase';
import {
  ListBlogCommentsUsecase,
  ListBlogCommentsByPostUsecase,
} from '@src/usecases/blog/blog-read.usecase';
import { BlogCommentObjectType } from './dto/blog-comment.dto';
import { BlogCommentsListResponse } from './dto/blog-comments.list';
import { BlogCommentsArgs } from './dto/blog-comments.args';
import { BlogPaginationArgs } from './dto/blog-pagination.args';
import { CreateBlogCommentInput } from './dto/create-blog-comment.input';
import { UpdateBlogCommentStatusInput } from './dto/update-blog-comment-status.input';
import { BatchUpdateBlogCommentStatusInput } from './dto/batch-update-blog-comment-status.input';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Resolver()
export class BlogCommentResolver {
  constructor(
    private readonly listBlogCommentsUsecase: ListBlogCommentsUsecase,
    private readonly listBlogCommentsByPostUsecase: ListBlogCommentsByPostUsecase,
    private readonly createBlogCommentUsecase: CreateBlogCommentUsecase,
    private readonly updateBlogCommentStatusUsecase: UpdateBlogCommentStatusUsecase,
    private readonly batchUpdateBlogCommentStatusUsecase: BatchUpdateBlogCommentStatusUsecase,
    private readonly deleteBlogCommentUsecase: DeleteBlogCommentUsecase,
  ) {}

  // ─── 管理端查询 ───

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Query(() => BlogCommentsListResponse, { description: '查询评论列表（管理端，支持筛选）' })
  async blogComments(@Args() args: BlogCommentsArgs): Promise<BlogCommentsListResponse> {
    const result = await this.listBlogCommentsUsecase.execute({
      page: args.page,
      pageSize: args.limit,
      sortBy: args.sortBy,
      sortOrder: args.sortOrder,
      postId: args.postId,
      status: args.status,
    });
    return {
      list: [...result.items],
      current: result.page ?? args.page,
      pageSize: result.pageSize ?? args.limit,
      total: result.total ?? 0,
    };
  }

  // ─── 公开查询 ───

  @Query(() => BlogCommentsListResponse, { description: '查询指定文章的评论列表（公开）' })
  async blogCommentsByPost(
    @Args('postId', { type: () => Int, description: '文章 ID' }) postId: number,
    @Args() args: BlogPaginationArgs,
  ): Promise<BlogCommentsListResponse> {
    // 公开评论默认从旧到新（ASC），覆盖 BlogPaginationArgs 的 DESC 默认值
    const sortOrder = args.sortOrder ?? 'ASC';
    const result = await this.listBlogCommentsByPostUsecase.execute({
      postId,
      page: args.page,
      pageSize: args.limit,
      sortBy: args.sortBy,
      sortOrder,
    });
    return {
      list: [...result.items],
      current: result.page ?? args.page,
      pageSize: result.pageSize ?? args.limit,
      total: result.total ?? 0,
    };
  }

  // ─── 公开 Mutation ───

  @Throttle({ publicWrite: { limit: 10, ttl: 60_000 } })
  @Mutation(() => BlogCommentObjectType, { description: '创建评论（公开）' })
  async createBlogComment(
    @Args('input') input: CreateBlogCommentInput,
  ): Promise<BlogCommentObjectType> {
    const { comment } = await this.createBlogCommentUsecase.execute({
      postId: input.postId,
      parentId: input.parentId,
      replyToId: input.replyToId,
      authorName: input.authorName,
      authorEmail: input.authorEmail,
      authorUrl: input.authorUrl,
      content: input.content,
    });
    return comment;
  }

  // ─── 管理端 Mutation ───

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => BlogCommentObjectType, { description: '更新评论审核状态' })
  async updateBlogCommentStatus(
    @Args('input') input: UpdateBlogCommentStatusInput,
  ): Promise<BlogCommentObjectType> {
    const { comment } = await this.updateBlogCommentStatusUsecase.execute({
      id: input.id,
      status: input.status,
    });
    return comment;
  }

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => Int, { description: '批量更新评论审核状态' })
  async batchUpdateBlogCommentStatus(
    @Args('input') input: BatchUpdateBlogCommentStatusInput,
  ): Promise<number> {
    const { updatedCount } = await this.batchUpdateBlogCommentStatusUsecase.execute({
      ids: input.ids,
      status: input.status,
    });
    return updatedCount;
  }

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => Boolean, { description: '删除评论' })
  async deleteBlogComment(
    @Args('id', { type: () => Int, description: '评论 ID' }) id: number,
  ): Promise<boolean> {
    const { deleted } = await this.deleteBlogCommentUsecase.execute(id);
    return deleted;
  }
}
