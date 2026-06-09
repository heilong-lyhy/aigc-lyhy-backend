// src/modules/blog/queries/blog-like.query.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlogLikeEntity } from '../entities/blog-like.entity';
import { BlogLikeQueryService } from './blog-like.query.service';

describe('BlogLikeQueryService', () => {
  let service: BlogLikeQueryService;

  const mockLikeRepo = {
    count: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogLikeQueryService,
        { provide: getRepositoryToken(BlogLikeEntity), useValue: mockLikeRepo },
      ],
    }).compile();

    service = module.get<BlogLikeQueryService>(BlogLikeQueryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── hasLiked ───

  describe('hasLiked', () => {
    it('用户已点赞时应返回 true', async () => {
      mockLikeRepo.count.mockResolvedValue(1);

      const result = await service.hasLiked(1, 'user1');

      expect(result).toBe(true);
      expect(mockLikeRepo.count).toHaveBeenCalledWith({
        where: { postId: 1, userIdentifier: 'user1' },
      });
    });

    it('用户未点赞时应返回 false', async () => {
      mockLikeRepo.count.mockResolvedValue(0);

      const result = await service.hasLiked(1, 'user1');

      expect(result).toBe(false);
    });

    it('同一用户对不同文章应独立判断', async () => {
      mockLikeRepo.count
        .mockResolvedValueOnce(1) // 文章1已点赞
        .mockResolvedValueOnce(0); // 文章2未点赞

      const liked1 = await service.hasLiked(1, 'user1');
      const liked2 = await service.hasLiked(2, 'user1');

      expect(liked1).toBe(true);
      expect(liked2).toBe(false);
    });
  });
});
