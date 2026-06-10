// src/modules/blog/queries/blog-comment.query.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlogCommentStatus } from '@app-types/models/blog.types';
import { BlogCommentEntity } from '../entities/blog-comment.entity';
import { BlogCommentQueryService } from './blog-comment.query.service';

describe('BlogCommentQueryService', () => {
  let service: BlogCommentQueryService;

  const mockEntity = {
    id: 1,
    postId: 10,
    parentId: null,
    replyToId: null,
    authorName: '访客',
    authorAvatar: 'https://avatar.example.com/test.png',
    content: '评论内容',
    status: BlogCommentStatus.APPROVED,
    nestingLevel: 0,
    isAdminReply: false,
    isHidden: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as unknown as BlogCommentEntity;

  const mockCommentRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogCommentQueryService,
        { provide: getRepositoryToken(BlogCommentEntity), useValue: mockCommentRepo },
      ],
    }).compile();

    service = module.get<BlogCommentQueryService>(BlogCommentQueryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── findCommentById ───

  describe('findCommentById', () => {
    it('存在时应返回视图', async () => {
      mockCommentRepo.findOne.mockResolvedValue(mockEntity);

      const result = await service.findCommentById(1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.postId).toBe(10);
      expect(result!.authorName).toBe('访客');
      expect(result!.status).toBe(BlogCommentStatus.APPROVED);
      expect(mockCommentRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('不存在时应返回 null', async () => {
      mockCommentRepo.findOne.mockResolvedValue(null);

      const result = await service.findCommentById(999);

      expect(result).toBeNull();
    });
  });

  // ─── toView ───

  describe('toView', () => {
    it('应正确映射 Entity 到 View', () => {
      const view = service.toView(mockEntity);

      expect(view.id).toBe(1);
      expect(view.postId).toBe(10);
      expect(view.parentId).toBeNull();
      expect(view.authorName).toBe('访客');
      expect(view.authorAvatar).toBe('https://avatar.example.com/test.png');
      expect(view.content).toBe('评论内容');
      expect(view.status).toBe(BlogCommentStatus.APPROVED);
      expect(view.nestingLevel).toBe(0);
      expect(view.isAdminReply).toBe(false);
      expect(view.isHidden).toBe(false);
    });
  });

  // ─── createCommentQueryBuilder ───

  describe('createCommentQueryBuilder', () => {
    it('无筛选条件时应创建基础 QueryBuilder', () => {
      const mockQb = {
        andWhere: jest.fn().mockReturnThis(),
      };
      mockCommentRepo.createQueryBuilder.mockReturnValue(mockQb);

      const qb = service.createCommentQueryBuilder({
        page: 1,
        pageSize: 10,
      });

      expect(mockCommentRepo.createQueryBuilder).toHaveBeenCalledWith('comment');
      expect(qb).toBe(mockQb);
    });

    it('有 postId 筛选时应添加 post_id 条件', () => {
      const mockQb = {
        andWhere: jest.fn().mockReturnThis(),
      };
      mockCommentRepo.createQueryBuilder.mockReturnValue(mockQb);

      service.createCommentQueryBuilder({
        page: 1,
        pageSize: 10,
        postId: 5,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('comment.post_id = :postId', { postId: 5 });
    });

    it('有 status 筛选时应添加 status 条件', () => {
      const mockQb = {
        andWhere: jest.fn().mockReturnThis(),
      };
      mockCommentRepo.createQueryBuilder.mockReturnValue(mockQb);

      service.createCommentQueryBuilder({
        page: 1,
        pageSize: 10,
        status: BlogCommentStatus.PENDING,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('comment.status = :status', {
        status: BlogCommentStatus.PENDING,
      });
    });
  });

  // ─── createCommentByPostQueryBuilder ───

  describe('createCommentByPostQueryBuilder', () => {
    it('应创建仅含已审核通过且未隐藏评论的 QueryBuilder', () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
      };
      mockCommentRepo.createQueryBuilder.mockReturnValue(mockQb);

      service.createCommentByPostQueryBuilder({
        postId: 5,
        page: 1,
        pageSize: 10,
      });

      expect(mockQb.where).toHaveBeenCalledWith('comment.post_id = :postId', { postId: 5 });
      expect(mockQb.andWhere).toHaveBeenCalledWith('comment.status = :status', {
        status: BlogCommentStatus.APPROVED,
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith('comment.is_hidden = :isHidden', {
        isHidden: false,
      });
    });
  });
});
