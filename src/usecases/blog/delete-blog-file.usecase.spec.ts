// src/usecases/blog/delete-blog-file.usecase.spec.ts

import { DomainError } from '@core/common/errors/domain-error';
import { BlogFileService } from '@src/modules/blog/blog-file.service';
import { DeleteBlogFileUsecase } from './delete-blog-file.usecase';

describe('DeleteBlogFileUsecase', () => {
  let usecase: DeleteBlogFileUsecase;
  let fileService: { softDeleteFile: jest.Mock; deletePhysicalFile: jest.Mock };
  let transactionRunner: { run: jest.Mock };

  beforeEach(() => {
    fileService = {
      softDeleteFile: jest.fn(),
      deletePhysicalFile: jest.fn(),
    };
    transactionRunner = {
      run: jest.fn((cb) => cb({})),
    };
    usecase = new DeleteBlogFileUsecase(
      fileService as unknown as BlogFileService,
      transactionRunner,
      // TRANSACTION_RUNNER token is not used in direct construction
    );
  });

  it('应事务内软删除，事务提交后删除物理文件', async () => {
    fileService.softDeleteFile.mockResolvedValue('image/abc123.jpg');
    fileService.deletePhysicalFile.mockResolvedValue(undefined);

    await usecase.execute(1);

    // 事务内调用 softDeleteFile
    expect(fileService.softDeleteFile).toHaveBeenCalledWith(1, expect.anything());
    // 事务外调用 deletePhysicalFile
    expect(fileService.deletePhysicalFile).toHaveBeenCalledWith('image/abc123.jpg');
  });

  it('文件不存在时事务内应抛出 DomainError', async () => {
    fileService.softDeleteFile.mockRejectedValue(new DomainError('FILE_NOT_FOUND', '文件不存在'));

    await expect(usecase.execute(999)).rejects.toThrow(DomainError);
    // 物理文件不应被删除
    expect(fileService.deletePhysicalFile).not.toHaveBeenCalled();
  });

  it('物理文件删除失败不应回滚数据库软删除', async () => {
    fileService.softDeleteFile.mockResolvedValue('image/abc123.jpg');
    fileService.deletePhysicalFile.mockRejectedValue(new Error('disk error'));

    // 物理文件删除失败时向上抛出，但数据库软删除已提交
    await expect(usecase.execute(1)).rejects.toThrow('disk error');
    expect(fileService.softDeleteFile).toHaveBeenCalled();
  });

  it('应通过 TransactionRunner 执行事务', async () => {
    fileService.softDeleteFile.mockResolvedValue('image/abc123.jpg');
    fileService.deletePhysicalFile.mockResolvedValue(undefined);

    await usecase.execute(1);

    expect(transactionRunner.run).toHaveBeenCalledTimes(1);
  });
});
