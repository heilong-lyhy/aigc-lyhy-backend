// src/modules/blog/queries/blog-file.query.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlogFileType } from '@app-types/models/blog.types';
import { BlogFileEntity } from '../entities/blog-file.entity';
import { BlogFileQueryService } from './blog-file.query.service';

describe('BlogFileQueryService', () => {
  let service: BlogFileQueryService;

  const mockEntity = {
    id: 1,
    originalName: 'test.jpg',
    storedName: 'test-abc123.jpg',
    mimeType: 'image/jpeg',
    fileSize: 1024,
    storagePath: '/uploads/test-abc123.jpg',
    fileType: BlogFileType.IMAGE,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as unknown as BlogFileEntity;

  const mockFileRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogFileQueryService,
        { provide: getRepositoryToken(BlogFileEntity), useValue: mockFileRepo },
      ],
    }).compile();

    service = module.get<BlogFileQueryService>(BlogFileQueryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── getFileById ───

  describe('getFileById', () => {
    it('存在时应返回视图', async () => {
      mockFileRepo.findOne.mockResolvedValue(mockEntity);

      const result = await service.getFileById(1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.originalName).toBe('test.jpg');
      expect(result!.storagePath).toBe('/uploads/test-abc123.jpg');
      expect(result!.fileType).toBe(BlogFileType.IMAGE);
      expect(mockFileRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('不存在时应返回 null', async () => {
      mockFileRepo.findOne.mockResolvedValue(null);

      const result = await service.getFileById(999);

      expect(result).toBeNull();
    });
  });

  // ─── toView ───

  describe('toView', () => {
    it('应正确映射 Entity 到 View', () => {
      const view = service.toView(mockEntity);

      expect(view.id).toBe(1);
      expect(view.originalName).toBe('test.jpg');
      expect(view.storedName).toBe('test-abc123.jpg');
      expect(view.mimeType).toBe('image/jpeg');
      expect(view.fileSize).toBe(1024);
      expect(view.storagePath).toBe('/uploads/test-abc123.jpg');
      expect(view.fileType).toBe(BlogFileType.IMAGE);
    });
  });

  // ─── createFileQueryBuilder ───

  describe('createFileQueryBuilder', () => {
    it('无筛选条件时应创建基础 QueryBuilder', () => {
      const mockQb = {
        andWhere: jest.fn().mockReturnThis(),
      };
      mockFileRepo.createQueryBuilder.mockReturnValue(mockQb);

      const qb = service.createFileQueryBuilder({
        page: 1,
        pageSize: 10,
      });

      expect(mockFileRepo.createQueryBuilder).toHaveBeenCalledWith('file');
      expect(qb).toBe(mockQb);
    });

    it('有 fileType 筛选时应添加条件', () => {
      const mockQb = {
        andWhere: jest.fn().mockReturnThis(),
      };
      mockFileRepo.createQueryBuilder.mockReturnValue(mockQb);

      service.createFileQueryBuilder({
        page: 1,
        pageSize: 10,
        fileType: BlogFileType.IMAGE,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('file.file_type = :fileType', {
        fileType: BlogFileType.IMAGE,
      });
    });
  });
});
