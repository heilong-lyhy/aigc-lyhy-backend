// src/modules/blog/blog-comment.service.spec.ts

import { DomainError } from '@core/common/errors/domain-error';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlogCommentStatus } from './blog.types';
import { BlogCommentEntity } from './entities/blog-comment.entity';
import { BlogCommentService } from './blog-comment.service';
import { BlogCommentQueryService } from './queries/blog-comment.query.service';
import {
  BLOG_AVATAR_GENERATOR_TOKEN,
  type AvatarGenerator,
} from './contracts/avatar-generator.contract';

describe('BlogCommentService', () => {
  let service: BlogCommentService;
  let commentRepo: jest.Mocked<Repository<BlogCommentEntity>>;
  let avatarGenerator: jest.Mocked<AvatarGenerator>;
  let queryService: { findCommentById: jest.Mock };

  const mockCommentRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softRemove: jest.fn(),
  };

  const mockAvatarGenerator = {
    generateAvatar: jest.fn(),
  };

  const mockQueryService = {
    findCommentById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogCommentService,
        { provide: getRepositoryToken(BlogCommentEntity), useValue: mockCommentRepo },
        { provide: BLOG_AVATAR_GENERATOR_TOKEN, useValue: mockAvatarGenerator },
        { provide: BlogCommentQueryService, useValue: mockQueryService },
      ],
    }).compile();

    service = module.get<BlogCommentService>(BlogCommentService);
    commentRepo = module.get(getRepositoryToken(BlogCommentEntity));
    avatarGenerator = module.get(BLOG_AVATAR_GENERATOR_TOKEN);
    queryService = mockQueryService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── createComment ───

  describe('createComment', () => {
    const baseInput = {
      postId: 1,
      authorName: '访客',
      authorEmail: 'test@example.com',
      content: '评论内容',
    };

    it('应成功创建顶级评论（无 parentId）', async () => {
      const savedEntity = {
        id: 1,
        postId: 1,
        parentId: null,
        replyToId: null,
        authorName: '访客',
        authorEmail: 'test@example.com',
        authorUrl: null,
        authorAvatar: 'https://avatar.example.com/test.png',
        content: '评论内容',
        status: BlogCommentStatus.PENDING,
        nestingLevel: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BlogCommentEntity;

      mockAvatarGenerator.generateAvatar.mockResolvedValue('https://avatar.example.com/test.png');
      commentRepo.create.mockReturnValue(savedEntity);
      commentRepo.save.mockResolvedValue(savedEntity);
      queryService.findCommentById.mockResolvedValue({
        id: 1,
        postId: 1,
        parentId: null,
        replyToId: null,
        authorName: '访客',
        authorAvatar: 'https://avatar.example.com/test.png',
        content: '评论内容',
        status: BlogCommentStatus.PENDING,
        nestingLevel: 0,
        createdAt: savedEntity.createdAt,
        updatedAt: savedEntity.updatedAt,
      });

      const result = await service.createComment(baseInput);

      expect(result).not.toBeNull();
      expect(result.nestingLevel).toBe(0);
      expect(result.authorAvatar).toBe('https://avatar.example.com/test.png');
      expect(avatarGenerator.generateAvatar).toHaveBeenCalledWith('test@example.com');
      expect(queryService.findCommentById).toHaveBeenCalledWith(1, undefined);
    });

    it('应成功创建子评论（nestingLevel = parent + 1）', async () => {
      const parentComment = {
        id: 10,
        nestingLevel: 2,
      } as BlogCommentEntity;

      const savedEntity = {
        id: 11,
        postId: 1,
        parentId: 10,
        replyToId: null,
        authorName: '访客',
        authorEmail: 'test@example.com',
        authorUrl: null,
        authorAvatar: 'avatar-url',
        content: '回复内容',
        status: BlogCommentStatus.PENDING,
        nestingLevel: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BlogCommentEntity;

      commentRepo.findOne.mockResolvedValue(parentComment);
      mockAvatarGenerator.generateAvatar.mockResolvedValue('avatar-url');
      commentRepo.create.mockReturnValue(savedEntity);
      commentRepo.save.mockResolvedValue(savedEntity);
      queryService.findCommentById.mockResolvedValue({
        id: 11,
        postId: 1,
        parentId: 10,
        replyToId: null,
        authorName: '访客',
        authorAvatar: 'avatar-url',
        content: '回复内容',
        status: BlogCommentStatus.PENDING,
        nestingLevel: 3,
        createdAt: savedEntity.createdAt,
        updatedAt: savedEntity.updatedAt,
      });

      const result = await service.createComment({ ...baseInput, parentId: 10 });

      expect(result).not.toBeNull();
      expect(result.nestingLevel).toBe(3);
    });

    it('父评论不存在时应抛出 COMMENT_NOT_FOUND', async () => {
      commentRepo.findOne.mockResolvedValue(null);

      await expect(service.createComment({ ...baseInput, parentId: 999 })).rejects.toThrow(
        DomainError,
      );

      await expect(service.createComment({ ...baseInput, parentId: 999 })).rejects.toThrow(
        '父评论不存在',
      );
    });

    it('嵌套层级超过上限时应抛出 COMMENT_NESTING_EXCEEDED', async () => {
      // MAX_NESTING_LEVEL = 5，parent 为 5 时子评论 nestingLevel = 6 > 5
      const parentComment = {
        id: 10,
        nestingLevel: 5,
      } as BlogCommentEntity;

      commentRepo.findOne.mockResolvedValue(parentComment);

      await expect(service.createComment({ ...baseInput, parentId: 10 })).rejects.toThrow(
        DomainError,
      );

      await expect(service.createComment({ ...baseInput, parentId: 10 })).rejects.toThrow(
        '评论嵌套层级超过上限',
      );
    });

    it('nestingLevel 刚好等于上限时应成功', async () => {
      // parent nestingLevel = 4 → child = 5，等于 MAX_NESTING_LEVEL，应通过
      const parentComment = {
        id: 10,
        nestingLevel: 4,
      } as BlogCommentEntity;

      const savedEntity = {
        id: 11,
        postId: 1,
        parentId: 10,
        replyToId: null,
        authorName: '访客',
        authorEmail: 'test@example.com',
        authorUrl: null,
        authorAvatar: 'avatar-url',
        content: '回复',
        status: BlogCommentStatus.PENDING,
        nestingLevel: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BlogCommentEntity;

      commentRepo.findOne.mockResolvedValue(parentComment);
      mockAvatarGenerator.generateAvatar.mockResolvedValue('avatar-url');
      commentRepo.create.mockReturnValue(savedEntity);
      commentRepo.save.mockResolvedValue(savedEntity);
      queryService.findCommentById.mockResolvedValue({
        id: 11,
        nestingLevel: 5,
      });

      const result = await service.createComment({ ...baseInput, parentId: 10 });
      expect(result).not.toBeNull();
      expect(result.nestingLevel).toBe(5);
    });
  });

  // ─── updateCommentStatus ───

  describe('updateCommentStatus', () => {
    it('应成功更新评论状态', async () => {
      const existing = {
        id: 1,
        status: BlogCommentStatus.PENDING,
      } as BlogCommentEntity;

      commentRepo.findOne.mockResolvedValue(existing);
      commentRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      queryService.findCommentById.mockResolvedValue({
        id: 1,
        status: BlogCommentStatus.APPROVED,
      });

      const result = await service.updateCommentStatus({
        id: 1,
        status: BlogCommentStatus.APPROVED,
      });

      expect(result).not.toBeNull();
      expect(result.status).toBe(BlogCommentStatus.APPROVED);
      expect(commentRepo.update).toHaveBeenCalledWith(1, { status: BlogCommentStatus.APPROVED });
      expect(queryService.findCommentById).toHaveBeenCalledWith(1, undefined);
    });

    it('评论不存在时应抛出 COMMENT_NOT_FOUND', async () => {
      commentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateCommentStatus({ id: 999, status: BlogCommentStatus.APPROVED }),
      ).rejects.toThrow(DomainError);
    });
  });

  // ─── batchUpdateCommentStatus ───

  describe('batchUpdateCommentStatus', () => {
    it('ids 为空时应直接返回 0', async () => {
      const count = await service.batchUpdateCommentStatus({
        ids: [],
        status: BlogCommentStatus.APPROVED,
      });
      expect(count).toBe(0);
      expect(commentRepo.update).not.toHaveBeenCalled();
    });

    it('应批量更新评论状态并返回实际更新行数', async () => {
      commentRepo.update.mockResolvedValue({ affected: 3, raw: [], generatedMaps: [] });

      const count = await service.batchUpdateCommentStatus({
        ids: [1, 2, 3],
        status: BlogCommentStatus.APPROVED,
      });

      expect(count).toBe(3);
      expect(commentRepo.update).toHaveBeenCalled();
    });

    it('部分 id 不存在时应返回实际更新的行数', async () => {
      commentRepo.update.mockResolvedValue({ affected: 2, raw: [], generatedMaps: [] });

      const count = await service.batchUpdateCommentStatus({
        ids: [1, 2, 999],
        status: BlogCommentStatus.APPROVED,
      });

      expect(count).toBe(2);
    });
  });

  // ─── softDeleteComment ───

  describe('softDeleteComment', () => {
    it('应成功软删除评论并返回 postId', async () => {
      const existing = { id: 1, postId: 42 } as BlogCommentEntity;
      commentRepo.findOne.mockResolvedValue(existing);
      commentRepo.softRemove.mockResolvedValue(existing);

      const postId = await service.softDeleteComment(1);
      expect(postId).toBe(42);
      expect(commentRepo.softRemove).toHaveBeenCalledWith(existing);
    });

    it('评论不存在时应抛出 COMMENT_NOT_FOUND', async () => {
      commentRepo.findOne.mockResolvedValue(null);

      await expect(service.softDeleteComment(999)).rejects.toThrow(DomainError);
    });
  });
});
