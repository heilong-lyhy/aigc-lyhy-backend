// src/modules/blog/queries/blog-file.query.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlogFileType } from '@app-types/models/blog.types';
import { BlogFileEntity } from '../entities/blog-file.entity';
import { BlogFileQueryService } from './blog-file.query.service';
import { PaginationQueryService } from '@modules/common/pagination.query.service';

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

  const mockPaginationService = {
    paginateQuery: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogFileQueryService,
        { provide: getRepositoryToken(BlogFileEntity), useValue: mockFileRepo },
        { provide: PaginationQueryService, useValue: mockPaginationService },
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

  // ─── paginateFiles ───

  describe('paginateFiles', () => {
    it('应委托 PaginationService 分页并映射视图', async () => {
      const mockQb = {
        andWhere: jest.fn().mockReturnThis(),
      };
      mockFileRepo.createQueryBuilder.mockReturnValue(mockQb);
      mockPaginationService.paginateQuery.mockResolvedValue({
        items: [mockEntity],
        total: 1,
        page: 1,
        pageSize: 10,
      });

      const result = await service.paginateFiles({ page: 1, pageSize: 10 });

      expect(mockFileRepo.createQueryBuilder).toHaveBeenCalledWith('file');
      expect(mockPaginationService.paginateQuery).toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });

    it('有 fileType 筛选时应添加条件', async () => {
      const mockQb = {
        andWhere: jest.fn().mockReturnThis(),
      };
      mockFileRepo.createQueryBuilder.mockReturnValue(mockQb);
      mockPaginationService.paginateQuery.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });

      await service.paginateFiles({
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
