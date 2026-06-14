// src/adapters/api/graphql/graphql-adapter.module.ts

import { AccountUsecasesModule } from '@src/usecases/account/account-usecases.module';
import { AiQueueUsecasesModule } from '@src/usecases/ai-queue/ai-queue-usecases.module';
import { AuthUsecasesModule } from '@src/usecases/auth/auth-usecases.module';
import { AsyncTaskRecordUsecasesModule } from '@src/usecases/async-task-record/async-task-record-usecases.module';
import { EmailQueueUsecasesModule } from '@src/usecases/email-queue/email-queue-usecases.module';
import { MagicItemCraftUsecasesModule } from '@src/usecases/magic-item-craft/magic-item-craft-usecases.module';
import { RegistrationUsecasesModule } from '@src/usecases/registration/registration-usecases.module';
import { ThirdPartyAccountsUsecasesModule } from '@src/usecases/third-party-accounts/third-party-accounts-usecases.module';
import { VerificationRecordUsecasesModule } from '@src/usecases/verification-record/verification-record-usecases.module';
import { VerificationUsecasesModule } from '@src/usecases/verification/verification-usecases.module';

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

// Blog GraphQL Adapter Module
import { BlogGraphQLAdapterModule } from './blog/blog-graphql-adapter.module';

// Resolvers
import { AccountResolver } from './account/account.resolver';
import { AiResolver } from './ai/ai.resolver';
import { UserInfoResolver } from './account/user-info.resolver';
import { AuthResolver } from './auth/auth.resolver';
import { EmailResolver } from './email/email.resolver';
import { MagicItemCraftResolver } from './magic-item-craft/magic-item-craft.resolver';
import { RegistrationResolver } from './registration/registration.resolver';
import { ThirdPartyAuthResolver } from './third-party-auth/third-party-auth.resolver';
import { VerificationRecordResolver } from './verification-record/verification-record.resolver';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { QmWorkerEntryGuard } from './guards/qm-worker-entry.guard';
import {
  QM_WORKER_ENTRY_OPTIONS,
  type QmWorkerEntryOptions,
} from './guards/qm-worker-entry.options';
import { JWT_STRATEGY_OPTIONS, type JwtStrategyOptions } from './strategies/jwt-strategy.options';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * GraphQL 适配器模块
 * 统一管理所有 GraphQL Resolvers 和相关的 Guards，遵循适配器层架构原则
 */
@Module({
  imports: [
    // 导入业务模块以获取服务
    AccountUsecasesModule,
    AiQueueUsecasesModule,
    AsyncTaskRecordUsecasesModule,
    AuthUsecasesModule,
    EmailQueueUsecasesModule,
    MagicItemCraftUsecasesModule,
    RegistrationUsecasesModule,
    ThirdPartyAccountsUsecasesModule,
    VerificationRecordUsecasesModule,
    VerificationUsecasesModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    BlogGraphQLAdapterModule,
  ],
  providers: [
    {
      provide: JWT_STRATEGY_OPTIONS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtStrategyOptions => {
        const secret = configService.get<string>('jwt.secret');
        if (!secret) {
          throw new Error('JWT secret 配置缺失');
        }
        const issuer = configService.get<string>('jwt.issuer')?.trim() || undefined;
        const audience = configService
          .get<string>('jwt.audience')
          ?.split(',')
          .map((audienceItem) => audienceItem.trim())
          .filter((audienceItem) => audienceItem.length > 0);
        return {
          secret,
          issuer,
          audience: audience && audience.length > 0 ? audience : undefined,
        };
      },
    },
    {
      provide: QM_WORKER_ENTRY_OPTIONS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): QmWorkerEntryOptions => ({
        aiEnabled: configService.get<boolean | undefined>('qmWorkerEntry.ai.enabled') === true,
        emailEnabled:
          configService.get<boolean | undefined>('qmWorkerEntry.email.enabled') === true,
        magicItemCraftEnabled:
          configService.get<boolean | undefined>('qmWorkerEntry.magicItemCraft.enabled') === true,
      }),
    },
    // Resolvers
    AccountResolver,
    AiResolver,
    AuthResolver,
    ThirdPartyAuthResolver,
    EmailResolver,
    MagicItemCraftResolver,
    RegistrationResolver,
    VerificationRecordResolver,
    UserInfoResolver,
    // Guards
    QmWorkerEntryGuard,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
    JwtStrategy,
  ],
  exports: [
    // Resolvers
    AccountResolver,
    AiResolver,
    AuthResolver,
    ThirdPartyAuthResolver,
    EmailResolver,
    MagicItemCraftResolver,
    RegistrationResolver,
    VerificationRecordResolver,
    UserInfoResolver,
    QmWorkerEntryGuard,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
    JwtStrategy,
  ],
})
export class GraphQLAdapterModule {}
