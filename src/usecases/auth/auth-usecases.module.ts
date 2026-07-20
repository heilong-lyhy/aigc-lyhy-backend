// src/usecases/auth/auth-usecases.module.ts
import { AuthModule } from '@modules/auth/auth.module';
import { ThirdPartyAuthModule } from '@modules/third-party-auth/third-party-auth.module';
import { Module } from '@nestjs/common';
import { AccountInstallerModule } from '@src/modules/account/account-installer.module';
import { DecideLoginRoleUsecase } from '@src/usecases/auth/decide-login-role.usecase';
import { EnrichLoginWithIdentityUsecase } from '@src/usecases/auth/enrich-login-with-identity.usecase';
import { ExecuteLoginFlowUsecase } from '@src/usecases/auth/execute-login-flow.usecase';
import { LoginWithUserInfoUsecase } from '@src/usecases/auth/login-with-user-info.usecase';
import { LogoutUsecase } from '@src/usecases/auth/logout.usecase';
import { RefreshAccessTokenUsecase } from '@src/usecases/auth/refresh-access-token.usecase';
import { ValidateAccessTokenSessionUsecase } from '@src/usecases/auth/validate-access-token-session.usecase';

@Module({
  imports: [AuthModule, ThirdPartyAuthModule, AccountInstallerModule],
  providers: [
    ExecuteLoginFlowUsecase,
    LoginWithUserInfoUsecase,
    DecideLoginRoleUsecase,
    EnrichLoginWithIdentityUsecase,
    ValidateAccessTokenSessionUsecase,
    LogoutUsecase,
    RefreshAccessTokenUsecase,
  ],
  exports: [
    ExecuteLoginFlowUsecase,
    LoginWithUserInfoUsecase,
    DecideLoginRoleUsecase,
    EnrichLoginWithIdentityUsecase,
    ValidateAccessTokenSessionUsecase,
    LogoutUsecase,
    RefreshAccessTokenUsecase,
  ],
})
export class AuthUsecasesModule {}
