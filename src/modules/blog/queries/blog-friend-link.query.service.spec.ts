// src/modules/blog/queries/blog-friend-link.query.service.spec.ts
// 友情链接读服务单元测试

import { BlogFriendLinkQueryService } from './blog-friend-link.query.service';
import { BlogFriendLinkEntity } from '../entities/blog-friend-link.entity';
import type { Repository } from 'typeorm';

describe('BlogFriendLinkQueryService', () => {
  let service: BlogFriendLinkQueryService;
  let repo: { findOne: jest.Mock; find: jest.Mock };

  const mockEntity: Partial<BlogFriendLinkEntity> = {
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
      find: jest.fn(),
    };

    service = new BlogFriendLinkQueryService(repo as unknown as Repository<BlogFriendLinkEntity>);
  });

  describe('findFriendLinkById', () => {
    it('存在时应返回视图', async () => {
      repo.findOne.mockResolvedValue(mockEntity);

      const result = await service.findFriendLinkById(1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.name).toBe('测试友链');
    });

    it('不存在时应返回 null', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.findFriendLinkById(999);

      expect(result).toBeNull();
    });
  });

  describe('listActiveFriendLinks', () => {
    it('应仅返回启用的友链', async () => {
      repo.find.mockResolvedValue([mockEntity]);

      const result = await service.listActiveFriendLinks();

      expect(result).toHaveLength(1);
      expect(repo.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      });
    });
  });

  describe('listAllFriendLinks', () => {
    it('应返回所有友链', async () => {
      const activeEntity = { ...mockEntity, isActive: true };
      const inactiveEntity = { ...mockEntity, id: 2, isActive: false };
      repo.find.mockResolvedValue([activeEntity, inactiveEntity]);

      const result = await service.listAllFriendLinks();

      expect(result).toHaveLength(2);
      expect(repo.find).toHaveBeenCalledWith({
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      });
    });
  });
});
