// src/infrastructure/typeorm/pagination/typeorm-pagination.module.ts
// TypeORM 分页基础设施模块：封装 HmacCursorSigner + TypeOrmPaginator + TypeOrmSort 的 DI wiring

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ICursorSigner, IPaginator } from '@core/pagination/pagination.contract';
import { PAGINATION_TOKENS } from '@core/pagination/pagination.tokens';
import { HmacCursorSigner } from '@src/infrastructure/security/hmac-signer';
import { TypeOrmPaginator } from './typeorm-paginator';
import { TypeOrmSort } from '../sort/typeorm-sort';

@Module({
  providers: [
    {
      provide: PAGINATION_TOKENS.CURSOR_SIGNER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ICursorSigner => {
        const secret = config.get<string>('pagination.hmacSecret');
        if (!secret) {
          throw new Error('pagination.hmacSecret is required');
        }
        return new HmacCursorSigner(secret);
      },
    },
    {
      provide: PAGINATION_TOKENS.PAGINATOR,
      inject: [PAGINATION_TOKENS.CURSOR_SIGNER],
      useFactory: (signer: ICursorSigner): IPaginator => new TypeOrmPaginator(signer),
    },
    {
      provide: 'DEFAULT_SORT_RESOLVER',
      useFactory: () => new TypeOrmSort([], {}),
    },
  ],
  exports: [PAGINATION_TOKENS.PAGINATOR, PAGINATION_TOKENS.CURSOR_SIGNER, 'DEFAULT_SORT_RESOLVER'],
})
export class TypeOrmPaginationModule {}
