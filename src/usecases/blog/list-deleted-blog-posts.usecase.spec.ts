// src/usecases/blog/list-deleted-blog-posts.usecase.spec.ts
// 列出已删除文章用例单元测试

import { BlogPostQueryService } from '@modules/blog/queries/blog-post.query.service';
import { PaginationService } from '@modules/common/pagination.service';
import { ListDeletedBlogPostsUsecase } from './list-deleted-blog-posts.usecase';

describe('ListDeletedBlogPostsUsecase', () => {
  let usecase: ListDeletedBlogPostsUsecase;
  let postQueryService: {
    createDeletedPostsQueryBuilder: jest.Mock;
    findDeletedPostsByIdsForViewMapping: jest.Mock;
  };
  let paginationService: { paginateQuery: jest.Mock };

  beforeEach(() => {
    postQueryService = {
      createDeletedPostsQueryBuilder: jest.fn(),
      findDeletedPostsByIdsForViewMapping: jest.fn(),
    };
    paginationService = { paginateQuery: jest.fn() };

    usecase = new ListDeletedBlogPostsUsecase(
      postQueryService as unknown as BlogPostQueryService,
      paginationService as unknown as PaginationService,
    );
  });

  it('应编排分页查询并返回已删除文章视图列表', async () => {
    const mockQb = {};
    postQueryService.createDeletedPostsQueryBuilder.mockReturnValue(mockQb);
    paginationService.paginateQuery.mockResolvedValue({
      items: [{ id: 1 }, { id: 2 }],
      total: 2,
      page: 1,
      pageSize: 10,
    });
    postQueryService.findDeletedPostsByIdsForViewMapping.mockResolvedValue([
      { id: 1, title: '已删除文章1' },
      { id: 2, title: '已删除文章2' },
    ]);

    const result = await usecase.execute({ page: 1, pageSize: 10 });

    expect(result.items).toHaveLength(2);
    expect(result.items[0].title).toBe('已删除文章1');
    expect(result.total).toBe(2);
    expect(postQueryService.createDeletedPostsQueryBuilder).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
    });
  });

  it('分页结果为空时不应调用 findDeletedPostsByIdsForViewMapping', async () => {
    const mockQb = {};
    postQueryService.createDeletedPostsQueryBuilder.mockReturnValue(mockQb);
    paginationService.paginateQuery.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    const result = await usecase.execute({ page: 1, pageSize: 10 });

    expect(result.items).toHaveLength(0);
    expect(postQueryService.findDeletedPostsByIdsForViewMapping).not.toHaveBeenCalled();
  });

  it('应透传排序参数', async () => {
    const mockQb = {};
    postQueryService.createDeletedPostsQueryBuilder.mockReturnValue(mockQb);
    paginationService.paginateQuery.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    await usecase.execute({ page: 1, pageSize: 10, sortBy: 'title', sortOrder: 'ASC' });

    expect(postQueryService.createDeletedPostsQueryBuilder).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      sortBy: 'title',
      sortOrder: 'ASC',
    });
  });

  it('无排序参数时应使用默认排序（deletedAt DESC）', async () => {
    const mockQb = {};
    postQueryService.createDeletedPostsQueryBuilder.mockReturnValue(mockQb);
    paginationService.paginateQuery.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    await usecase.execute({ page: 1, pageSize: 10 });

    const paginateArgs = paginationService.paginateQuery.mock.calls[0][0];
    expect(paginateArgs.defaultSorts).toEqual([{ field: 'deletedAt', direction: 'DESC' }]);
  });
});
