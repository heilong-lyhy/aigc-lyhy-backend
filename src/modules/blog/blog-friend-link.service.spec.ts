// src/modules/blog/blog-friend-link.service.spec.ts
// 友情链接写服务单元测试

import { BlogFriendLinkService } from './blog-friend-link.service';
import { BlogFriendLinkQueryService } from './queries/blog-friend-link.query.service';
import { BlogFriendLinkEntity } from './entities/blog-friend-link.entity';
import { DomainError } from '@core/common/errors/domain-error';
import type { Repository } from 'typeorm';

describe('BlogFriendLinkService', () => {
  let service: BlogFriendLinkService;
  let repo: {
    findOne: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    softRemove: jest.Mock;
    create: jest.Mock;
  };
  let queryService: { findFriendLinkById: jest.Mock };

  const mockView = {
    id: 1,
    name: '测试友链',
    url: 'https://example.com',
    description: '描述',
    logoUrl: 'https://example.com/logo.png',
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repo = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      softRemove: jest.fn(),
      create: jest.fn(),
    };
    queryService = { findFriendLinkById: jest.fn() };

    service = new BlogFriendLinkService(
      repo as unknown as Repository<BlogFriendLinkEntity>,
      queryService as unknown as BlogFriendLinkQueryService,
    );
  });

  describe('createFriendLink', () => {
    it('应创建友链并返回视图', async () => {
      const entity = { id: 1, name: '测试友链', url: 'https://example.com' };
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);
      queryService.findFriendLinkById.mockResolvedValue(mockView);

      const result = await service.createFriendLink({
        name: '测试友链',
        url: 'https://example.com',
      });

      expect(result).toEqual(mockView);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: '测试友链', url: 'https://example.com' }),
      );
    });
  });

  describe('updateFriendLink', () => {
    it('应更新友链并返回视图', async () => {
      const entity = { id: 1, name: '旧名称', url: 'https://old.com' };
      repo.findOne.mockResolvedValue(entity);
      repo.update.mockResolvedValue({ affected: 1 });
      queryService.findFriendLinkById.mockResolvedValue({ ...mockView, name: '新名称' });

      const result = await service.updateFriendLink(1, { name: '新名称' });

      expect(result.name).toBe('新名称');
      expect(repo.update).toHaveBeenCalledWith(1, { name: '新名称' });
    });

    it('友链不存在时应抛出 DomainError', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.updateFriendLink(999, { name: '新名称' })).rejects.toThrow(DomainError);
      await expect(service.updateFriendLink(999, { name: '新名称' })).rejects.toThrow(
        '友情链接不存在',
      );
    });

    it('无变更时应直接返回视图', async () => {
      repo.findOne.mockResolvedValue({ id: 1 });
      queryService.findFriendLinkById.mockResolvedValue(mockView);

      const result = await service.updateFriendLink(1, {});

      expect(result).toEqual(mockView);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('softDeleteFriendLink', () => {
    it('应软删除友链', async () => {
      repo.findOne.mockResolvedValue({ id: 1 });
      repo.softRemove.mockResolvedValue({ id: 1 });

      await service.softDeleteFriendLink(1);

      expect(repo.softRemove).toHaveBeenCalled();
    });

    it('友链不存在时应抛出 DomainError', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.softDeleteFriendLink(999)).rejects.toThrow(DomainError);
    });
  });
});
