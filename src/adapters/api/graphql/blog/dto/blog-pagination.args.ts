// src/adapters/api/graphql/blog/dto/blog-pagination.args.ts
// 博客列表查询通用分页参数（offset/limit 风格，与项目现有模式一致）

import { ArgsType, Field, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { GqlSortDirection } from '@src/adapters/api/graphql/pagination.enums';

@ArgsType()
export class BlogPaginationArgs {
  @Field(() => Int, { description: '页码（从 1 开始）', defaultValue: 1 })
  @IsOptional()
  @IsInt({ message: '页码必须是整数' })
  @Min(1, { message: '页码必须大于等于 1' })
  page: number = 1;

  @Field(() => Int, { description: '每页数量', defaultValue: 10 })
  @IsOptional()
  @IsInt({ message: '每页数量必须是整数' })
  @Min(1, { message: '每页数量必须大于等于 1' })
  @Max(100, { message: '每页数量不能超过 100' })
  limit: number = 10;

  @Field(() => String, { description: '排序字段', defaultValue: 'createdAt', nullable: true })
  @IsOptional()
  @IsString({ message: '排序字段必须是字符串' })
  sortBy?: string = 'createdAt';

  @Field(() => GqlSortDirection, { description: '排序方向', defaultValue: 'DESC', nullable: true })
  @IsOptional()
  @IsEnum(GqlSortDirection, { message: '排序方向无效，仅支持 ASC / DESC' })
  sortOrder?: GqlSortDirection = GqlSortDirection.DESC;
}
