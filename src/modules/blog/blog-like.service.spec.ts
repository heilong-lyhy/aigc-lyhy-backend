// src/modules/blog/blog-like.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BlogLikeService } from './blog-like.service';
import { BlogLikeEntity } from './entities/blog-like.entity';

describe('BlogLikeService', () => {
  let service: BlogLikeService;

  const mockLikeRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogLikeService,
        { provide: getRepositoryToken(BlogLikeEntity), useValue: mockLikeRepo },
      ],
    }).compile();

    service = module.get<BlogLikeService>(BlogLikeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── toggleLike ───

  describe('toggleLike', () => {
    it('未点赞时应执行点赞（插入），返回 liked=true', async () => {
      mockLikeRepo.findOne.mockResolvedValue(null);
      mockLikeRepo.create.mockReturnValue({ postId: 1, userIdentifier: 'user1' });
      mockLikeRepo.save.mockResolvedValue({ id: 1, postId: 1, userIdentifier: 'user1' });

      const result = await service.toggleLike(1, 'user1');

      expect(result.liked).toBe(true);
      expect(mockLikeRepo.save).toHaveBeenCalled();
    });

    it('已点赞时应取消点赞（删除），返回 liked=false', async () => {
      const existingLike = { id: 1, postId: 1, userIdentifier: 'user1' } as BlogLikeEntity;

      mockLikeRepo.findOne.mockResolvedValue(existingLike);
      mockLikeRepo.remove.mockResolvedValue(existingLike);

      const result = await service.toggleLike(1, 'user1');

      expect(result.liked).toBe(false);
      expect(mockLikeRepo.remove).toHaveBeenCalledWith(existingLike);
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

  // ─── toggleLike 事务上下文 ───

  describe('toggleLike (transaction context)', () => {
    it('未点赞时应通过事务上下文执行点赞', async () => {
      mockLikeRepo.findOne.mockResolvedValue(null);
      mockLikeRepo.create.mockReturnValue({ postId: 1, userIdentifier: 'user1' });
      mockLikeRepo.save.mockResolvedValue({ id: 1, postId: 1, userIdentifier: 'user1' });

      const mockEntityManager = { getRepository: jest.fn().mockReturnValue(mockLikeRepo) };
      const { createTypeOrmPersistenceTransactionContext } =
        await import('@src/infrastructure/database/transaction/typeorm-persistence-transaction-context');
      const transactionContext = createTypeOrmPersistenceTransactionContext(
        mockEntityManager as never,
      );

      const result = await service.toggleLike(1, 'user1', transactionContext);

      expect(result.liked).toBe(true);
      expect(mockEntityManager.getRepository).toHaveBeenCalledWith(BlogLikeEntity);
    });

    it('已点赞时应通过事务上下文执行取消点赞', async () => {
      const existingLike = { id: 1, postId: 1, userIdentifier: 'user1' } as BlogLikeEntity;

      mockLikeRepo.findOne.mockResolvedValue(existingLike);
      mockLikeRepo.remove.mockResolvedValue(existingLike);

      const mockEntityManager = { getRepository: jest.fn().mockReturnValue(mockLikeRepo) };
      const { createTypeOrmPersistenceTransactionContext } =
        await import('@src/infrastructure/database/transaction/typeorm-persistence-transaction-context');
      const transactionContext = createTypeOrmPersistenceTransactionContext(
        mockEntityManager as never,
      );

      const result = await service.toggleLike(1, 'user1', transactionContext);

      expect(result.liked).toBe(false);
      expect(mockEntityManager.getRepository).toHaveBeenCalledWith(BlogLikeEntity);
    });
  });
});
