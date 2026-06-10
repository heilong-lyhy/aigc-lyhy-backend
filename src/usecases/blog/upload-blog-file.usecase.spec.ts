// src/usecases/blog/upload-blog-file.usecase.spec.ts

import { BLOG_ERROR, DomainError } from '@core/common/errors/domain-error';
import { BlogFileType } from '@app-types/models/blog.types';
import { BlogFileService } from '@modules/blog/blog-file.service';
import { UploadBlogFileUsecase } from './upload-blog-file.usecase';

describe('UploadBlogFileUsecase', () => {
  let usecase: UploadBlogFileUsecase;
  let fileService: { uploadFile: jest.Mock };

  const validInput = {
    originalName: 'photo.jpg',
    mimeType: 'image/jpeg',
    fileSize: 1024,
    storedName: 'abc123.jpg',
    fileType: BlogFileType.IMAGE,
    buffer: Buffer.from('fake-image'),
  };

  const mockFileView = {
    id: 1,
    originalName: 'photo.jpg',
    storedName: 'abc123.jpg',
    mimeType: 'image/jpeg',
    fileSize: 1024,
    storagePath: 'image/abc123.jpg',
    fileType: BlogFileType.IMAGE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    fileService = {
      uploadFile: jest.fn(),
    };
    usecase = new UploadBlogFileUsecase(fileService as unknown as BlogFileService);
  });

  it('应成功上传文件并返回结果', async () => {
    fileService.uploadFile.mockResolvedValue(mockFileView);

    const result = await usecase.execute(validInput);

    expect(result.file).toBe(mockFileView);
    expect(fileService.uploadFile).toHaveBeenCalledWith(validInput);
  });

  it('文件类型不在白名单时应抛出 DomainError', async () => {
    fileService.uploadFile.mockRejectedValue(
      new DomainError(BLOG_ERROR.FILE_TYPE_NOT_ALLOWED, '不支持的文件类型'),
    );

    await expect(
      usecase.execute({ ...validInput, mimeType: 'application/x-executable' }),
    ).rejects.toThrow(DomainError);
  });

  it('文件大小超过限制时应抛出 DomainError', async () => {
    fileService.uploadFile.mockRejectedValue(
      new DomainError(BLOG_ERROR.FILE_SIZE_EXCEEDED, '文件大小超过限制'),
    );

    await expect(usecase.execute({ ...validInput, fileSize: 20 * 1024 * 1024 })).rejects.toThrow(
      DomainError,
    );
  });

  it('存储服务异常时应向上抛出', async () => {
    fileService.uploadFile.mockRejectedValue(new Error('storage write failed'));

    await expect(usecase.execute(validInput)).rejects.toThrow('storage write failed');
  });
});
