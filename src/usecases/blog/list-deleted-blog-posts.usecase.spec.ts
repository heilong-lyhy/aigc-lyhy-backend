// src/usecases/blog/list-deleted-blog-posts.usecase.spec.ts
// 列出已删除文章用例单元测试

import { BlogPostQueryService } from '@modules/blog/queries/blog-post.query.service';
import { ListDeletedBlogPostsUsecase } from './list-deleted-blog-posts.usecase';

describe('ListDeletedBlogPostsUsecase', () => {
  let usecase: ListDeletedBlogPostsUsecase;
  let postQueryService: { paginateDeletedPosts: jest.Mock };

  beforeEach(() => {
    postQueryService = { paginateDeletedPosts: jest.fn() };

    usecase = new ListDeletedBlogPostsUsecase(postQueryService as unknown as BlogPostQueryService);
  });

  it('应委托 QueryService 分页查询并返回已删除文章视图列表', async () => {
    const expectedResult = {
      items: [
        { id: 1, title: '已删除文章1' },
        { id: 2, title: '已删除文章2' },
      ],
      total: 2,
      page: 1,
      pageSize: 10,
    };
    postQueryService.paginateDeletedPosts.mockResolvedValue(expectedResult);

    const result = await usecase.execute({ page: 1, pageSize: 10 });

    expect(result).toEqual(expectedResult);
    expect(postQueryService.paginateDeletedPosts).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
  });

  it('应透传排序参数', async () => {
    postQueryService.paginateDeletedPosts.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    await usecase.execute({ page: 1, pageSize: 10, sortBy: 'title', sortOrder: 'ASC' });

    expect(postQueryService.paginateDeletedPosts).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
      sortBy: 'title',
      sortOrder: 'ASC',
    });
  });
});
