// src/usecases/blog/change-blog-admin-password.usecase.spec.ts

import { ACCOUNT_ERROR, DomainError } from '@core/common/errors/domain-error';
import { AccountService } from '@src/modules/account/base/services/account.service';
import { ChangeBlogAdminPasswordUsecase } from './change-blog-admin-password.usecase';

describe('ChangeBlogAdminPasswordUsecase', () => {
  let usecase: ChangeBlogAdminPasswordUsecase;
  let accountService: { changePassword: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  const validInput = {
    accountId: 1,
    currentPassword: 'OldPassword123!',
    newPassword: 'NewPassword456!',
  };

  beforeEach(() => {
    accountService = {
      changePassword: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new ChangeBlogAdminPasswordUsecase(
      accountService as unknown as AccountService,
      transactionRunner,
    );
  });

  it('应成功修改密码并返回 accountId', async () => {
    accountService.changePassword.mockResolvedValue(undefined);

    const result = await usecase.execute(validInput);

    expect(result.accountId).toBe(1);
    expect(accountService.changePassword).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 1,
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword456!',
      }),
    );
  });

  it('账户不存在时应抛出 DomainError', async () => {
    accountService.changePassword.mockRejectedValue(
      new DomainError(ACCOUNT_ERROR.ACCOUNT_NOT_FOUND, '账户不存在'),
    );

    await expect(usecase.execute({ ...validInput, accountId: 999 })).rejects.toThrow(DomainError);
  });

  it('旧密码不正确时应抛出 DomainError', async () => {
    accountService.changePassword.mockRejectedValue(
      new DomainError(ACCOUNT_ERROR.ACCOUNT_PASSWORD_MISMATCH, '当前密码不正确'),
    );

    await expect(
      usecase.execute({ ...validInput, currentPassword: 'WrongPassword!' }),
    ).rejects.toThrow(DomainError);
  });

  it('新密码不符合策略时应抛出 DomainError', async () => {
    accountService.changePassword.mockRejectedValue(
      new DomainError(ACCOUNT_ERROR.ACCOUNT_PASSWORD_POLICY_VIOLATION, '密码不符合安全要求'),
    );

    await expect(usecase.execute({ ...validInput, newPassword: '123' })).rejects.toThrow(
      DomainError,
    );
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    accountService.changePassword.mockResolvedValue(undefined);

    await usecase.execute(validInput);

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });

  it('应将 transactionContext 传递给 AccountService.changePassword', async () => {
    accountService.changePassword.mockResolvedValue(undefined);

    await usecase.execute(validInput);

    expect(accountService.changePassword).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionContext: expect.anything(),
      }),
    );
  });
});
