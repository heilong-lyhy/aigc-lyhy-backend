import { VerificationCodeHelper } from './verification-code.helper';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationReadQueryService } from './queries/verification-read.query.service';
import { VerificationRecordReadRepository } from './repositories/verification-record.read.repo';
import { VerificationRecordEntity } from './verification-record.entity';
import { VerificationRecordService } from './verification-record.service';

/**
 * 验证记录模块
 * 提供统一的验证/邀请记录管理功能
 */
@Module({
  imports: [TypeOrmModule.forFeature([VerificationRecordEntity])],
  providers: [
    VerificationRecordService,
    VerificationRecordReadRepository,
    VerificationReadQueryService,
    VerificationCodeHelper,
  ],
  exports: [
    TypeOrmModule,
    VerificationRecordService,
    VerificationRecordReadRepository,
    VerificationReadQueryService,
    VerificationCodeHelper,
  ],
})
export class VerificationRecordModule {}
