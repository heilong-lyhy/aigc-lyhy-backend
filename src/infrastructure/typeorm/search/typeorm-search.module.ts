// src/infrastructure/typeorm/search/typeorm-search.module.ts
// TypeORM 搜索基础设施模块：封装 TypeOrmSearch 的 DI wiring

import { Module } from '@nestjs/common';
import { TypeOrmSearch } from './typeorm-search';

export const SEARCH_ENGINE_TOKEN = Symbol('SEARCH_ENGINE');

@Module({
  providers: [{ provide: SEARCH_ENGINE_TOKEN, useClass: TypeOrmSearch }],
  exports: [SEARCH_ENGINE_TOKEN],
})
export class TypeOrmSearchModule {}
