// src/modules/blog/blog-like.service.spec.ts

import { DomainError } from '@core/common/errors';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
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

    it('并发竞态撞 unique 约束时应抛 DomainError(LIKE_FAILED)', async () => {
      const dupError = new QueryFailedError('', [], new Error('Duplicate entry') as never);
      // 模拟 driverError 字段，触发 isUniqueConstraintViolation
      (dupError as unknown as { driverError: unknown }).driverError = {
        code: 'ER_DUP_ENTRY',
        errno: 1062,
        sqlState: '23000',
      };

      mockLikeRepo.findOne.mockResolvedValue(null);
      mockLikeRepo.create.mockReturnValue({ postId: 1, userIdentifier: 'user1' });
      mockLikeRepo.save.mockRejectedValue(dupError);

      await expect(service.toggleLike(1, 'user1')).rejects.toMatchObject({
        code: 'BLOG_LIKE_FAILED',
      });
      // 确认是 DomainError 实例，details 携带上下文
      await expect(service.toggleLike(1, 'user1')).rejects.toBeInstanceOf(DomainError);
    });

    it('非 unique 约束的保存错误应原样上抛', async () => {
      const otherError = new QueryFailedError('', [], new Error('Deadlock') as never);

      mockLikeRepo.findOne.mockResolvedValue(null);
      mockLikeRepo.create.mockReturnValue({ postId: 1, userIdentifier: 'user1' });
      mockLikeRepo.save.mockRejectedValue(otherError);

      await expect(service.toggleLike(1, 'user1')).rejects.toBe(otherError);
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
