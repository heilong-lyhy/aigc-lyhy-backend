// src/modules/blog/queries/blog-dashboard.query.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlogCategoryEntity } from '../entities/blog-category.entity';
import { BlogCommentEntity } from '../entities/blog-comment.entity';
import { BlogLikeEntity } from '../entities/blog-like.entity';
import { BlogPostEntity } from '../entities/blog-post.entity';
import { BlogTagEntity } from '../entities/blog-tag.entity';
import { BlogDashboardQueryService } from './blog-dashboard.query.service';

describe('BlogDashboardQueryService', () => {
  let service: BlogDashboardQueryService;

  const createMockRepo = () => ({
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  const mockPostRepo = createMockRepo();
  const mockCategoryRepo = createMockRepo();
  const mockTagRepo = createMockRepo();
  const mockCommentRepo = createMockRepo();
  const mockLikeRepo = createMockRepo();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogDashboardQueryService,
        { provide: getRepositoryToken(BlogPostEntity), useValue: mockPostRepo },
        { provide: getRepositoryToken(BlogCategoryEntity), useValue: mockCategoryRepo },
        { provide: getRepositoryToken(BlogTagEntity), useValue: mockTagRepo },
        { provide: getRepositoryToken(BlogCommentEntity), useValue: mockCommentRepo },
        { provide: getRepositoryToken(BlogLikeEntity), useValue: mockLikeRepo },
      ],
    }).compile();

    service = module.get<BlogDashboardQueryService>(BlogDashboardQueryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('应返回完整的仪表盘统计数据', async () => {
      mockPostRepo.count
        .mockResolvedValueOnce(25) // totalPosts
        .mockResolvedValueOnce(20) // publishedPosts
        .mockResolvedValueOnce(5); // draftPosts
      mockCategoryRepo.count.mockResolvedValue(8);
      mockTagRepo.count.mockResolvedValue(15);
      mockCommentRepo.count
        .mockResolvedValueOnce(100) // totalComments
        .mockResolvedValueOnce(3); // pendingComments
      mockLikeRepo.count.mockResolvedValue(500);

      // sumPostViewCount
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalViews: '12345' }),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getDashboardStats();

      expect(result).toEqual({
        totalPosts: 25,
        publishedPosts: 20,
        draftPosts: 5,
        totalCategories: 8,
        totalTags: 15,
        totalComments: 100,
        pendingComments: 3,
        totalLikes: 500,
        totalViews: 12345,
      });
    });

    it('无数据时应返回全零统计', async () => {
      mockPostRepo.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockCategoryRepo.count.mockResolvedValue(0);
      mockTagRepo.count.mockResolvedValue(0);
      mockCommentRepo.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockLikeRepo.count.mockResolvedValue(0);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalViews: '0' }),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getDashboardStats();

      expect(result.totalPosts).toBe(0);
      expect(result.publishedPosts).toBe(0);
      expect(result.draftPosts).toBe(0);
      expect(result.totalCategories).toBe(0);
      expect(result.totalTags).toBe(0);
      expect(result.totalComments).toBe(0);
      expect(result.pendingComments).toBe(0);
      expect(result.totalLikes).toBe(0);
      expect(result.totalViews).toBe(0);
    });

    it('sumPostViewCount 返回 null 时应回退为 0', async () => {
      mockPostRepo.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockCategoryRepo.count.mockResolvedValue(0);
      mockTagRepo.count.mockResolvedValue(0);
      mockCommentRepo.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockLikeRepo.count.mockResolvedValue(0);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      };
      mockPostRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getDashboardStats();

      expect(result.totalViews).toBe(0);
    });
  });
});
