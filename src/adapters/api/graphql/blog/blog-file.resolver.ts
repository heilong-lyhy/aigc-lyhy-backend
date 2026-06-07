// src/adapters/api/graphql/blog/blog-file.resolver.ts
// 文件 GraphQL Resolver：输入解析、权限接入与输出封装

import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';
import { UploadBlogFileUsecase } from '@src/usecases/blog/upload-blog-file.usecase';
import { DeleteBlogFileUsecase } from '@src/usecases/blog/delete-blog-file.usecase';
import { ListBlogFilesUsecase } from '@src/usecases/blog/blog-read.usecase';
import { BlogFileType } from '@app-types/models/blog.types';
import { BlogFileObjectType } from './dto/blog-file.dto';
import { BlogFilesListResponse } from './dto/blog-files.list';
import { BlogFilesArgs } from './dto/blog-files.args';
import { UploadBlogFileInput } from './dto/upload-blog-file.input';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@Resolver()
export class BlogFileResolver {
  constructor(
    private readonly listBlogFilesUsecase: ListBlogFilesUsecase,
    private readonly uploadBlogFileUsecase: UploadBlogFileUsecase,
    private readonly deleteBlogFileUsecase: DeleteBlogFileUsecase,
  ) {}

  // ─── 管理端查询 ───

  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Query(() => BlogFilesListResponse, { description: '查询文件列表（管理端）' })
  async blogFiles(@Args() args: BlogFilesArgs): Promise<BlogFilesListResponse> {
    const result = await this.listBlogFilesUsecase.execute({
      page: args.page,
      pageSize: args.limit,
      sortBy: args.sortBy,
      sortOrder: args.sortOrder,
      fileType: args.fileType,
    });
    return {
      list: [...result.items],
      current: result.page ?? args.page,
      pageSize: result.pageSize ?? args.limit,
      total: result.total ?? 0,
    };
  }

  // ─── 管理端 Mutation ───

  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => BlogFileObjectType, { description: '上传文件' })
  async uploadBlogFile(@Args('input') input: UploadBlogFileInput): Promise<BlogFileObjectType> {
    const upload = await input.file;
    const buffer = Buffer.from(await upload.createReadStream().toArray());

    const { file } = await this.uploadBlogFileUsecase.execute({
      originalName: upload.filename,
      mimeType: upload.mimetype,
      fileSize: buffer.length,
      storedName: upload.filename,
      fileType: input.fileType ?? BlogFileType.IMAGE,
      buffer,
    });
    return file;
  }

  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Mutation(() => Boolean, { description: '删除文件' })
  async deleteBlogFile(
    @Args('id', { type: () => Int, description: '文件 ID' }) id: number,
  ): Promise<boolean> {
    await this.deleteBlogFileUsecase.execute(id);
    return true;
  }
}
