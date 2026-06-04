// src/modules/blog/blog-like.service.spec.ts

import { DomainError } from '@core/common/errors/domain-error';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlogLikeService } from './blog-like.service';
import { BlogLikeEntity } from './entities/blog-like.entity';
import { BlogPostEntity } from './entities/blog-post.entity';

describe('BlogLikeService', () => {
  let service: BlogLikeService;

  const mockLikeRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
  };

  const mockPostRepo = {
    findOne: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogLikeService,
        { provide: getRepositoryToken(BlogLikeEntity), useValue: mockLikeRepo },
        { provide: getRepositoryToken(BlogPostEntity), useValue: mockPostRepo },
      ],
    }).compile();

    service = module.get<BlogLikeService>(BlogLikeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── toggleLike ───

  describe('toggleLike', () => {
    it('文章不存在时应抛出 POST_NOT_FOUND', async () => {
      mockPostRepo.findOne.mockResolvedValue(null);

      await expect(service.toggleLike(999, 'user1')).rejects.toThrow(DomainError);
      await expect(service.toggleLike(999, 'user1')).rejects.toThrow('文章不存在');
    });

    it('未点赞时应执行点赞（插入 + increment）', async () => {
      const post = { id: 1, likeCount: 5 } as BlogPostEntity;
      const updatedPost = { id: 1, likeCount: 6 } as BlogPostEntity;

      mockPostRepo.findOne.mockResolvedValueOnce(post);
      mockLikeRepo.findOne.mockResolvedValue(null);
      mockLikeRepo.create.mockReturnValue({ postId: 1, userIdentifier: 'user1' });
      mockLikeRepo.save.mockResolvedValue({ id: 1, postId: 1, userIdentifier: 'user1' });
      mockPostRepo.increment.mockResolvedValue(undefined);
      mockPostRepo.findOne.mockResolvedValueOnce(updatedPost);

      const result = await service.toggleLike(1, 'user1');

      expect(result.liked).toBe(true);
      expect(result.likeCount).toBe(6);
      expect(mockLikeRepo.save).toHaveBeenCalled();
      expect(mockPostRepo.increment).toHaveBeenCalledWith({ id: 1 }, 'likeCount', 1);
    });

    it('已点赞时应取消点赞（删除 + decrement）', async () => {
      const post = { id: 1, likeCount: 6 } as BlogPostEntity;
      const existingLike = { id: 1, postId: 1, userIdentifier: 'user1' } as BlogLikeEntity;
      const updatedPost = { id: 1, likeCount: 5 } as BlogPostEntity;

      mockPostRepo.findOne.mockResolvedValueOnce(post);
      mockLikeRepo.findOne.mockResolvedValue(existingLike);
      mockLikeRepo.remove.mockResolvedValue(existingLike);
      mockPostRepo.decrement.mockResolvedValue(undefined);
      mockPostRepo.findOne.mockResolvedValueOnce(updatedPost);

      const result = await service.toggleLike(1, 'user1');

      expect(result.liked).toBe(false);
      expect(result.likeCount).toBe(5);
      expect(mockLikeRepo.remove).toHaveBeenCalledWith(existingLike);
      expect(mockPostRepo.decrement).toHaveBeenCalledWith({ id: 1 }, 'likeCount', 1);
    });
  });

  // ─── deleteLikesByPostId ───

  describe('deleteLikesByPostId', () => {
    it('应删除指定文章的所有点赞', async () => {
      mockLikeRepo.delete.mockResolvedValue(undefined);

      await service.deleteLikesByPostId(1);

      expect(mockLikeRepo.delete).toHaveBeenCalledWith({ postId: 1 });
    });
  });
});
