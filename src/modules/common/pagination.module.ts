// src/modules/common/pagination.module.ts
// 绑定分页器与游标签名器实现，并导出 PaginationService

import { Module } from '@nestjs/common';

import { PaginationService } from './pagination.service';
import { PAGINATION_TOKENS } from './tokens/pagination.tokens';

import { TypeOrmPaginationModule } from '@src/infrastructure/typeorm/pagination/typeorm-pagination.module';

@Module({
  imports: [TypeOrmPaginationModule],
  providers: [PaginationService],
  exports: [PAGINATION_TOKENS.PAGINATOR, PAGINATION_TOKENS.CURSOR_SIGNER, PaginationService],
})
export class PaginationModule {}
