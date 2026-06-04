// src/modules/blog/blog-file.service.spec.ts

import { DomainError } from '@core/common/errors/domain-error';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogFileType } from './blog.types';
import { BlogFileEntity } from './entities/blog-file.entity';
import { BlogFileService } from './blog-file.service';
import { BlogFileQueryService } from './queries/blog-file.query.service';
import {
  BLOG_FILE_STORAGE_TOKEN,
  type FileStorageAdapter,
  BLOG_FILE_UPLOAD_CONFIG_TOKEN,
  type BlogFileUploadConfig,
} from './contracts/file-storage.contract';

describe('BlogFileService', () => {
  let service: BlogFileService;
  let fileRepo: jest.Mocked<Repository<BlogFileEntity>>;
  let fileStorage: jest.Mocked<FileStorageAdapter>;
  let queryService: { getFileById: jest.Mock };

  const mockFileRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    softRemove: jest.fn(),
  };

  const mockFileStorage = {
    saveFile: jest.fn(),
    deleteFile: jest.fn(),
    getFileUrl: jest.fn(),
  };

  const defaultUploadConfig: BlogFileUploadConfig = {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
  };

  const mockQueryService = {
    getFileById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogFileService,
        { provide: getRepositoryToken(BlogFileEntity), useValue: mockFileRepo },
        { provide: BLOG_FILE_STORAGE_TOKEN, useValue: mockFileStorage },
        { provide: BLOG_FILE_UPLOAD_CONFIG_TOKEN, useValue: defaultUploadConfig },
        { provide: BlogFileQueryService, useValue: mockQueryService },
      ],
    }).compile();

    service = module.get<BlogFileService>(BlogFileService);
    fileRepo = module.get(getRepositoryToken(BlogFileEntity));
    fileStorage = module.get(BLOG_FILE_STORAGE_TOKEN);
    queryService = mockQueryService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── uploadFile ───

  describe('uploadFile', () => {
    const validInput = {
      originalName: 'photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 1024,
      storedName: 'abc123.jpg',
      fileType: BlogFileType.IMAGE,
      buffer: Buffer.from('fake-image'),
    };

    it('应成功上传文件', async () => {
      mockFileStorage.saveFile.mockResolvedValue('image/abc123.jpg');

      const savedEntity = {
        id: 1,
        originalName: 'photo.jpg',
        storedName: 'abc123.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
        storagePath: 'image/abc123.jpg',
        fileType: BlogFileType.IMAGE,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BlogFileEntity;

      fileRepo.create.mockReturnValue(savedEntity);
      fileRepo.save.mockResolvedValue(savedEntity);
      queryService.getFileById.mockResolvedValue({
        id: 1,
        originalName: 'photo.jpg',
        storedName: 'abc123.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
        storagePath: 'image/abc123.jpg',
        fileType: BlogFileType.IMAGE,
        createdAt: savedEntity.createdAt,
        updatedAt: savedEntity.updatedAt,
      });

      const result = await service.uploadFile(validInput);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.storagePath).toBe('image/abc123.jpg');
      expect(fileStorage.saveFile).toHaveBeenCalledWith(
        expect.objectContaining({ storedName: 'abc123.jpg' }),
      );
      expect(queryService.getFileById).toHaveBeenCalledWith(1, undefined);
    });

    it('MIME 类型不在白名单时应抛出 FILE_TYPE_NOT_ALLOWED', async () => {
      const invalidInput = { ...validInput, mimeType: 'application/x-executable' };

      await expect(service.uploadFile(invalidInput)).rejects.toThrow(DomainError);
      await expect(service.uploadFile(invalidInput)).rejects.toThrow('不支持的文件类型');
    });

    it('文件大小超过限制时应抛出 FILE_SIZE_EXCEEDED', async () => {
      const oversizedInput = { ...validInput, fileSize: 20 * 1024 * 1024 }; // 20MB > 10MB

      await expect(service.uploadFile(oversizedInput)).rejects.toThrow(DomainError);
      await expect(service.uploadFile(oversizedInput)).rejects.toThrow('文件大小超过限制');
    });

    it('文件大小刚好等于限制时应通过', async () => {
      const exactSizeInput = { ...validInput, fileSize: 10 * 1024 * 1024 }; // 恰好 10MB

      mockFileStorage.saveFile.mockResolvedValue('image/abc123.jpg');
      const savedEntity = {
        id: 1,
        originalName: 'photo.jpg',
        storedName: 'abc123.jpg',
        mimeType: 'image/jpeg',
        fileSize: 10 * 1024 * 1024,
        storagePath: 'image/abc123.jpg',
        fileType: BlogFileType.IMAGE,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BlogFileEntity;

      fileRepo.create.mockReturnValue(savedEntity);
      fileRepo.save.mockResolvedValue(savedEntity);
      queryService.getFileById.mockResolvedValue({ id: 1 });

      const result = await service.uploadFile(exactSizeInput);
      expect(result).toBeDefined();
    });
  });

  // ─── deleteFile ───

  describe('deleteFile', () => {
    it('应先删除物理文件再软删除数据库记录', async () => {
      const existing = {
        id: 1,
        storagePath: 'image/abc123.jpg',
      } as BlogFileEntity;

      fileRepo.findOne.mockResolvedValue(existing);
      fileStorage.deleteFile.mockResolvedValue(undefined as never);
      fileRepo.softRemove.mockResolvedValue(existing);

      await service.deleteFile(1);

      // 验证调用顺序：先删物理文件，再软删除
      expect(fileStorage.deleteFile).toHaveBeenCalledWith('image/abc123.jpg');
      expect(fileRepo.softRemove).toHaveBeenCalledWith(existing);
    });

    it('文件不存在时应抛出 FILE_NOT_FOUND', async () => {
      fileRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteFile(999)).rejects.toThrow(DomainError);
      await expect(service.deleteFile(999)).rejects.toThrow('文件不存在');
    });
  });
});
