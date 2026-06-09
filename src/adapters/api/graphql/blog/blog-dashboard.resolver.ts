// src/adapters/api/graphql/blog/blog-dashboard.resolver.ts
// 仪表盘 GraphQL Resolver：输入解析、权限接入与输出封装

import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';
import { GetBlogDashboardStatsUsecase } from '@src/usecases/blog/blog-read.usecase';
import { BlogDashboardObjectType } from './dto/blog-dashboard.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Resolver()
export class BlogDashboardResolver {
  constructor(private readonly getBlogDashboardStatsUsecase: GetBlogDashboardStatsUsecase) {}

  @SkipThrottle({ short: true, publicWrite: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Query(() => BlogDashboardObjectType, { description: '查询博客仪表盘统计' })
  async blogDashboardStats(): Promise<BlogDashboardObjectType> {
    return this.getBlogDashboardStatsUsecase.execute();
  }
}
