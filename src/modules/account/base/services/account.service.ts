// src/modules/account/base/services/account.service.ts

import type { PersistenceTransactionContext } from '@app-types/common/transaction.types';
import {
  AccountStatus,
  AudienceTypeEnum,
  IdentityTypeEnum,
  LoginHistoryItemModel,
} from '@app-types/models/account.types';
import { Gender, type GeographicInfo, UserState } from '@app-types/models/user-info.types';
import { ACCOUNT_ERROR, DomainError } from '@core/common/errors/domain-error';
import { validatePasswordNormalize } from '@core/common/password/normalize-password';
import { LegacyPasswordCryptoHelper } from '@modules/common/password/legacy-password-crypto.helper';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getTypeOrmEntityManager } from '@src/infrastructure/database/transaction/typeorm-persistence-transaction-context';
import { Repository } from 'typeorm';

// ✅ base 层实体（始终存在）
import { AccountEntity } from '../entities/account.entity';
import { UserInfoEntity } from '../entities/user-info.entity';
export interface AccountCreateData {
  loginName?: string | null;
  loginEmail?: string | null;
  loginPassword?: string;
  status?: AccountStatus;
  audience?: AudienceTypeEnum;
  identityHint?: string | null;
  recentLoginHistory?: LoginHistoryItemModel[] | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserInfoCreateData {
  accountId?: number;
  nickname?: string;
  gender?: Gender;
  birthDate?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
  signature?: string | null;
  accessGroup?: IdentityTypeEnum[];
  address?: string | null;
  phone?: string | null;
  tags?: string[] | null;
  geographic?: GeographicInfo | null;
  metaDigest?: IdentityTypeEnum[] | null;
  notifyCount?: number;
  unreadCount?: number;
  userState?: UserState;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserInfoUpdateData {
  nickname?: string;
  gender?: Gender;
  birthDate?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
  signature?: string | null;
  address?: string | null;
  phone?: string | null;
  tags?: string[] | null;
  geographic?: GeographicInfo | null;
  notifyCount?: number;
  unreadCount?: number;
  userState?: UserState;
}

export interface AccountSaveResult {
  readonly createdAt: Date;
  readonly id: number;
}

export interface AccountLockResult {
  readonly id: number;
  readonly identityHint: string | null;
}

@Injectable()
export class AccountService {
  constructor(
    // private readonly passwordHelper: PasswordPbkdf2Helper, // 移除这行
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(UserInfoEntity)
    private readonly userInfoRepository: Repository<UserInfoEntity>,
  ) {}

  // =========================================================
  // 登录历史 & 账户/用户信息（原样保留）
  // =========================================================

  /** 记录用户登录历史：保留最近 5 条（新记录 + 旧 4 条） */
  async recordLoginHistory(
    accountId: number,
    timestamp: string,
    ip?: string,
    audience?: string,
  ): Promise<void> {
    const account = await this.accountRepository.findOne({
      where: { id: accountId },
      select: { recentLoginHistory: true },
    });

    const newHistoryItem: LoginHistoryItemModel = { ip: ip || '', timestamp, audience };
    const existingHistory = account?.recentLoginHistory || [];
    const updatedHistory: LoginHistoryItemModel[] = [
      newHistoryItem,
      ...existingHistory.slice(0, 4),
    ];

    await this.accountRepository.update(accountId, {
      recentLoginHistory: updatedHistory,
      updatedAt: new Date(),
    });
  }

  async createAndSaveAccount(params: {
    accountData: AccountCreateData;
    transactionContext?: PersistenceTransactionContext;
  }): Promise<AccountSaveResult> {
    const { accountData, transactionContext } = params;
    const repository = this.getAccountRepository(transactionContext);
    const entity = repository.create(accountData);
    const saved = await repository.save(entity);
    return { id: saved.id, createdAt: saved.createdAt };
  }

  /** 更新账户 */
  async updateAccount(
    id: number,
    updateData: Partial<AccountEntity>,
    transactionContext?: PersistenceTransactionContext,
  ): Promise<void> {
    const repository = this.getAccountRepository(transactionContext);
    await repository.update(id, updateData);
  }

  async updateAccountPasswordHash(params: {
    accountId: number;
    passwordHash: string;
    transactionContext?: PersistenceTransactionContext;
  }): Promise<void> {
    const repository = this.getAccountRepository(params.transactionContext);
    await repository.update(params.accountId, {
      loginPassword: params.passwordHash,
      updatedAt: new Date(),
    });
  }

  async lockByIdForUpdate(
    accountId: number,
    transactionContext: PersistenceTransactionContext,
  ): Promise<AccountLockResult> {
    const repository = this.getAccountRepository(transactionContext);
    const account = await repository
      .createQueryBuilder('account')
      .where('account.id = :accountId', { accountId })
      .setLock('pessimistic_write')
      .getOne();

    if (!account) {
      throw new DomainError(ACCOUNT_ERROR.ACCOUNT_NOT_FOUND, '账户不存在');
    }

    return { id: account.id, identityHint: account.identityHint };
  }

  async createAndSaveUserInfo(params: {
    userInfoData: UserInfoCreateData;
    transactionContext?: PersistenceTransactionContext;
  }): Promise<void> {
    const { userInfoData, transactionContext } = params;
    const repository = this.getUserInfoRepository(transactionContext);
    const entity = repository.create(userInfoData);
    await repository.save(entity);
  }

  async updateUserInfoFields(params: {
    accountId: number;
    patch: UserInfoUpdateData;
    transactionContext?: PersistenceTransactionContext;
  }): Promise<void> {
    if (Object.keys(params.patch).length === 0) {
      return;
    }
    const repository = this.getUserInfoRepository(params.transactionContext);
    await repository.update(
      { accountId: params.accountId },
      {
        ...params.patch,
        updatedAt: new Date(),
      },
    );
  }

  /**
   * 更新用户 accessGroup 并同步 metaDigest
   */
  async updateUserInfoAccessGroup(params: {
    accountId: number;
    accessGroup: IdentityTypeEnum[];
    transactionContext: PersistenceTransactionContext;
  }): Promise<{ isUpdated: boolean }> {
    const { accountId, accessGroup, transactionContext } = params;
    const repository = this.getUserInfoRepository(transactionContext);
    const userInfo = await repository.findOne({ where: { accountId } });
    if (!userInfo) {
      throw new DomainError(ACCOUNT_ERROR.USER_INFO_NOT_FOUND, '用户信息不存在');
    }

    const current = userInfo.accessGroup ?? [];
    const isSame =
      current.length === accessGroup.length && current.every((v, i) => v === accessGroup[i]);
    if (isSame) {
      return { isUpdated: false };
    }

    userInfo.accessGroup = accessGroup;
    userInfo.metaDigest = accessGroup;
    userInfo.updatedAt = new Date();
    await repository.save(userInfo);
    return { isUpdated: true };
  }

  // =========================================================
  // 密码工具（原样保留）
  // =========================================================

  /** 使用创建时间作为盐值进行 PBKDF2 加密 */
  static hashPasswordWithTimestamp(password: string, createdAt: Date): string {
    // 应用与 PasswordPolicyService 相同的预处理
    const processedPassword = AccountService.preprocessPassword(password);
    const salt = createdAt.toString();
    return LegacyPasswordCryptoHelper.hashPasswordWithCrypto(processedPassword, salt);
  }

  /** 验证密码 */
  static verifyPassword(password: string, hashedPassword: string, createdAt: Date): boolean {
    // 应用与 PasswordPolicyService 相同的预处理
    const processedPassword = AccountService.preprocessPassword(password);
    const salt = createdAt.toString();
    return LegacyPasswordCryptoHelper.verifyPasswordWithCrypto(
      processedPassword,
      salt,
      hashedPassword,
    );
  }

  /**
   * 密码预处理 - 统一调用 validatePasswordNormalize
   * validatePasswordNormalize 不合法时直接抛 DomainError（INPUT_NORMALIZE_ERROR），合法时返回规范化密码
   * @param password 原始密码
   * @returns 预处理后的密码
   */
  private static preprocessPassword(password: string): string {
    return validatePasswordNormalize(password);
  }

  private getAccountRepository(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<AccountEntity> {
    return transactionContext
      ? getTypeOrmEntityManager(transactionContext).getRepository(AccountEntity)
      : this.accountRepository;
  }

  private getUserInfoRepository(
    transactionContext?: PersistenceTransactionContext,
  ): Repository<UserInfoEntity> {
    return transactionContext
      ? getTypeOrmEntityManager(transactionContext).getRepository(UserInfoEntity)
      : this.userInfoRepository;
  }
}
