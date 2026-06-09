// src/usecases/blog/blog-read.usecase.spec.ts
// 博客读操作 usecase 单元测试：验证编排逻辑（分页、publishedOnly 过滤、委托调用）

import { BlogPostStatus, BlogCommentStatus, BlogFileType } from '@app-types/models/blog.types';
import {
  GetBlogPostByIdUsecase,
  GetBlogPostBySlugUsecase,
  ListBlogPostsUsecase,
  ListBlogPublishedPostsUsecase,
  ListBlogCategoriesUsecase,
  GetBlogCategoryTreeUsecase,
  ListBlogTagsUsecase,
  ListBlogCommentsUsecase,
  ListBlogCommentsByPostUsecase,
  HasLikedBlogPostUsecase,
  ListBlogFilesUsecase,
  GetBlogProfileUsecase,
  GetBlogDashboardStatsUsecase,
} from './blog-read.usecase';
import { BlogPostQueryService } from '@src/modules/blog/queries/blog-post.query.service';
import { BlogPostService } from '@src/modules/blog/blog-post.service';
import { BlogCategoryQueryService } from '@src/modules/blog/queries/blog-category.query.service';
import { BlogTagQueryService } from '@src/modules/blog/queries/blog-tag.query.service';
import { BlogCommentQueryService } from '@src/modules/blog/queries/blog-comment.query.service';
import { BlogLikeQueryService } from '@src/modules/blog/queries/blog-like.query.service';
import { BlogFileQueryService } from '@src/modules/blog/queries/blog-file.query.service';
import { BlogProfileQueryService } from '@src/modules/blog/queries/blog-profile.query.service';
import { BlogDashboardQueryService } from '@src/modules/blog/queries/blog-dashboard.query.service';
import { PaginationService } from '@src/modules/common/pagination.service';

// ─── GetBlogPostByIdUsecase ───

describe('GetBlogPostByIdUsecase', () => {
  let usecase: GetBlogPostByIdUsecase;
  let postQueryService: { findPostById: jest.Mock };

  beforeEach(() => {
    postQueryService = { findPostById: jest.fn() };
    usecase = new GetBlogPostByIdUsecase(postQueryService as unknown as BlogPostQueryService);
  });

  it('应返回文章详情', async () => {
    const view = { id: 1, title: '文章', status: BlogPostStatus.PUBLISHED };
    postQueryService.findPostById.mockResolvedValue(view);

    const result = await usecase.execute(1);

    expect(result).toEqual(view);
  });

  it('文章不存在时应返回 null', async () => {
    postQueryService.findPostById.mockResolvedValue(null);

    const result = await usecase.execute(999);

    expect(result).toBeNull();
  });

  it('publishedOnly=true 时非发布文章应返回 null', async () => {
    const view = { id: 1, title: '草稿', status: BlogPostStatus.DRAFT };
    postQueryService.findPostById.mockResolvedValue(view);

    const result = await usecase.execute(1, { publishedOnly: true });

    expect(result).toBeNull();
  });

  it('publishedOnly=true 时发布文章应正常返回', async () => {
    const view = { id: 1, title: '已发布', status: BlogPostStatus.PUBLISHED };
    postQueryService.findPostById.mockResolvedValue(view);

    const result = await usecase.execute(1, { publishedOnly: true });

    expect(result).toEqual(view);
  });
});

// ─── GetBlogPostBySlugUsecase ───

describe('GetBlogPostBySlugUsecase', () => {
  let usecase: GetBlogPostBySlugUsecase;
  let postQueryService: { findPostBySlug: jest.Mock };
  let postService: { incrementViewCount: jest.Mock };

  beforeEach(() => {
    postQueryService = { findPostBySlug: jest.fn() };
    postService = { incrementViewCount: jest.fn().mockResolvedValue(undefined) };
    usecase = new GetBlogPostBySlugUsecase(
      postQueryService as unknown as BlogPostQueryService,
      postService as unknown as BlogPostService,
    );
  });

  it('应通过 slug 查询文章', async () => {
    const view = { id: 1, slug: 'test-post', status: BlogPostStatus.PUBLISHED };
    postQueryService.findPostBySlug.mockResolvedValue(view);

    const result = await usecase.execute('test-post');

    expect(result).toEqual(view);
  });

  it('slug 不存在时应返回 null', async () => {
    postQueryService.findPostBySlug.mockResolvedValue(null);

    const result = await usecase.execute('nonexistent');

    expect(result).toBeNull();
  });

  it('publishedOnly=true 时非发布文章应返回 null', async () => {
    const view = { id: 1, slug: 'draft', status: BlogPostStatus.DRAFT };
    postQueryService.findPostBySlug.mockResolvedValue(view);

    const result = await usecase.execute('draft', { publishedOnly: true });

    expect(result).toBeNull();
  });

  it('publishedOnly=true 且文章存在时应调用 incrementViewCount', async () => {
    const view = { id: 1, slug: 'test-post', status: BlogPostStatus.PUBLISHED };
    postQueryService.findPostBySlug.mockResolvedValue(view);

    await usecase.execute('test-post', { publishedOnly: true });

    expect(postService.incrementViewCount).toHaveBeenCalledWith(1);
  });

  it('文章不存在时不应调用 incrementViewCount', async () => {
    postQueryService.findPostBySlug.mockResolvedValue(null);

    await usecase.execute('nonexistent');

    expect(postService.incrementViewCount).not.toHaveBeenCalled();
  });

  it('incrementViewCount 失败时不应影响详情返回且应记录警告日志', async () => {
    const view = { id: 1, slug: 'test-post', status: BlogPostStatus.PUBLISHED };
    postQueryService.findPostBySlug.mockResolvedValue(view);
    postService.incrementViewCount.mockRejectedValue(new Error('DB error'));

    const loggerWarnSpy = jest.spyOn(usecase['logger'], 'warn');

    const result = await usecase.execute('test-post', { publishedOnly: true });

    expect(result).toEqual(view);
    expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('阅读量自增失败 postId=1'));
  });

  it('非 publishedOnly 时不应调用 incrementViewCount', async () => {
    const view = { id: 1, slug: 'test-post', status: BlogPostStatus.PUBLISHED };
    postQueryService.findPostBySlug.mockResolvedValue(view);

    await usecase.execute('test-post');

    expect(postService.incrementViewCount).not.toHaveBeenCalled();
  });
});

// ─── ListBlogPostsUsecase ───

describe('ListBlogPostsUsecase', () => {
  let usecase: ListBlogPostsUsecase;
  let postQueryService: {
    createPostQueryBuilder: jest.Mock;
    findPostsByIdsForViewMapping: jest.Mock;
  };
  let paginationService: { paginateQuery: jest.Mock };

  beforeEach(() => {
    postQueryService = {
      createPostQueryBuilder: jest.fn(),
      findPostsByIdsForViewMapping: jest.fn(),
    };
    paginationService = { paginateQuery: jest.fn() };
    usecase = new ListBlogPostsUsecase(
      postQueryService as unknown as BlogPostQueryService,
      paginationService as unknown as PaginationService,
    );
  });

  it('应编排分页查询并返回视图列表', async () => {
    const mockQb = {};
    postQueryService.createPostQueryBuilder.mockReturnValue(mockQb);
    paginationService.paginateQuery.mockResolvedValue({
      items: [{ id: 1 }, { id: 2 }],
      total: 2,
      page: 1,
      pageSize: 10,
    });
    postQueryService.findPostsByIdsForViewMapping.mockResolvedValue([
      { id: 1, title: '文章1' },
      { id: 2, title: '文章2' },
    ]);

    const result = await usecase.execute({ page: 1, pageSize: 10 });

    expect(result.items).toHaveLength(2);
    expect(result.items[0].title).toBe('文章1');
    expect(result.total).toBe(2);
  });

  it('分页结果为空时不应调用 findPostsByIdsForViewMapping', async () => {
    const mockQb = {};
    postQueryService.createPostQueryBuilder.mockReturnValue(mockQb);
    paginationService.paginateQuery.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    const result = await usecase.execute({ page: 1, pageSize: 10 });

    expect(result.items).toHaveLength(0);
    expect(postQueryService.findPostsByIdsForViewMapping).not.toHaveBeenCalled();
  });
});

// ─── ListBlogPublishedPostsUsecase ───

describe('ListBlogPublishedPostsUsecase', () => {
  let usecase: ListBlogPublishedPostsUsecase;
  let listBlogPostsUsecase: { execute: jest.Mock };

  beforeEach(() => {
    listBlogPostsUsecase = { execute: jest.fn() };
    usecase = new ListBlogPublishedPostsUsecase(
      listBlogPostsUsecase as unknown as ListBlogPostsUsecase,
    );
  });

  it('应强制设置 status=PUBLISHED 并委托 ListBlogPostsUsecase', async () => {
    const expectedResult = { items: [], total: 0, page: 1, pageSize: 10 };
    listBlogPostsUsecase.execute.mockResolvedValue(expectedResult);

    const result = await usecase.execute({ page: 1, pageSize: 10 });

    expect(listBlogPostsUsecase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ status: BlogPostStatus.PUBLISHED }),
    );
    expect(result).toEqual(expectedResult);
  });

  it('应透传 categoryId 和 title 筛选', async () => {
    listBlogPostsUsecase.execute.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });

    await usecase.execute({ page: 1, pageSize: 10, categoryId: 5, title: '关键词' });

    expect(listBlogPostsUsecase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        status: BlogPostStatus.PUBLISHED,
        categoryId: 5,
        title: '关键词',
      }),
    );
  });
});

// ─── ListBlogCategoriesUsecase ───

describe('ListBlogCategoriesUsecase', () => {
  let usecase: ListBlogCategoriesUsecase;
  let categoryQueryService: { listAllCategories: jest.Mock };

  beforeEach(() => {
    categoryQueryService = { listAllCategories: jest.fn() };
    usecase = new ListBlogCategoriesUsecase(
      categoryQueryService as unknown as BlogCategoryQueryService,
    );
  });

  it('应委托 QueryService 返回分类列表', async () => {
    const categories = [{ id: 1, name: '技术' }];
    categoryQueryService.listAllCategories.mockResolvedValue(categories);

    const result = await usecase.execute();

    expect(result).toEqual(categories);
  });
});

// ─── GetBlogCategoryTreeUsecase ───

describe('GetBlogCategoryTreeUsecase', () => {
  let usecase: GetBlogCategoryTreeUsecase;
  let categoryQueryService: { getCategoryTree: jest.Mock };

  beforeEach(() => {
    categoryQueryService = { getCategoryTree: jest.fn() };
    usecase = new GetBlogCategoryTreeUsecase(
      categoryQueryService as unknown as BlogCategoryQueryService,
    );
  });

  it('应委托 QueryService 返回分类树', async () => {
    const tree = [{ id: 1, name: '技术', children: [] }];
    categoryQueryService.getCategoryTree.mockResolvedValue(tree);

    const result = await usecase.execute();

    expect(result).toEqual(tree);
  });
});

// ─── ListBlogTagsUsecase ───

describe('ListBlogTagsUsecase', () => {
  let usecase: ListBlogTagsUsecase;
  let tagQueryService: { listAllTags: jest.Mock };

  beforeEach(() => {
    tagQueryService = { listAllTags: jest.fn() };
    usecase = new ListBlogTagsUsecase(tagQueryService as unknown as BlogTagQueryService);
  });

  it('应委托 QueryService 返回标签列表', async () => {
    const tags = [{ id: 1, name: 'TypeScript', postCount: 3 }];
    tagQueryService.listAllTags.mockResolvedValue(tags);

    const result = await usecase.execute();

    expect(result).toEqual(tags);
  });
});

// ─── ListBlogCommentsUsecase ───

describe('ListBlogCommentsUsecase', () => {
  let usecase: ListBlogCommentsUsecase;
  let commentQueryService: {
    createCommentQueryBuilder: jest.Mock;
    toView: jest.Mock;
  };
  let paginationService: { paginateQuery: jest.Mock };

  beforeEach(() => {
    commentQueryService = {
      createCommentQueryBuilder: jest.fn(),
      toView: jest.fn(),
    };
    paginationService = { paginateQuery: jest.fn() };
    usecase = new ListBlogCommentsUsecase(
      commentQueryService as unknown as BlogCommentQueryService,
      paginationService as unknown as PaginationService,
    );
  });

  it('应编排分页查询并返回评论视图列表', async () => {
    const mockQb = {};
    const mockEntity = { id: 1, content: '评论1' };
    const mockView = { id: 1, content: '评论1' };
    commentQueryService.createCommentQueryBuilder.mockReturnValue(mockQb);
    paginationService.paginateQuery.mockResolvedValue({
      items: [mockEntity],
      total: 1,
      page: 1,
      pageSize: 10,
    });
    commentQueryService.toView.mockReturnValue(mockView);

    const result = await usecase.execute({ page: 1, pageSize: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(mockView);
    expect(result.total).toBe(1);
    expect(commentQueryService.createCommentQueryBuilder).toHaveBeenCalledWith({
      page: 1,
      pageSize: 10,
    });
  });

  it('分页结果为空时不应调用 toView', async () => {
    const mockQb = {};
    commentQueryService.createCommentQueryBuilder.mockReturnValue(mockQb);
    paginationService.paginateQuery.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    const result = await usecase.execute({ page: 1, pageSize: 10 });

    expect(result.items).toHaveLength(0);
    expect(commentQueryService.toView).not.toHaveBeenCalled();
  });

  it('应透传 postId 和 status 筛选参数', async () => {
    const mockQb = {};
    commentQueryService.createCommentQueryBuilder.mockReturnValue(mockQb);
    paginationService.paginateQuery.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    await usecase.execute({ page: 1, pageSize: 10, postId: 5, status: BlogCommentStatus.PENDING });

    expect(commentQueryService.createCommentQueryBuilder).toHaveBeenCalledWith(
      expect.objectContaining({ postId: 5, status: 'PENDING' }),
    );
  });
});

// ─── ListBlogCommentsByPostUsecase ───

describe('ListBlogCommentsByPostUsecase', () => {
  let usecase: ListBlogCommentsByPostUsecase;
  let commentQueryService: {
    createCommentByPostQueryBuilder: jest.Mock;
    toView: jest.Mock;
  };
  let paginationService: { paginateQuery: jest.Mock };

  beforeEach(() => {
    commentQueryService = {
      createCommentByPostQueryBuilder: jest.fn(),
      toView: jest.fn(),
    };
    paginationService = { paginateQuery: jest.fn() };
    usecase = new ListBlogCommentsByPostUsecase(
      commentQueryService as unknown as BlogCommentQueryService,
      paginationService as unknown as PaginationService,
    );
  });

  it('应编排分页查询并返回评论视图列表', async () => {
    const mockQb = {};
    const mockEntity = { id: 1, content: '公开评论' };
    const mockView = { id: 1, content: '公开评论' };
    commentQueryService.createCommentByPostQueryBuilder.mockReturnValue(mockQb);
    paginationService.paginateQuery.mockResolvedValue({
      items: [mockEntity],
      total: 1,
      page: 1,
      pageSize: 10,
    });
    commentQueryService.toView.mockReturnValue(mockView);

    const result = await usecase.execute({ postId: 5, page: 1, pageSize: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(mockView);
    expect(commentQueryService.createCommentByPostQueryBuilder).toHaveBeenCalledWith({
      postId: 5,
      page: 1,
      pageSize: 10,
    });
  });

  it('分页结果为空时不应调用 toView', async () => {
    const mockQb = {};
    commentQueryService.createCommentByPostQueryBuilder.mockReturnValue(mockQb);
    paginationService.paginateQuery.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    const result = await usecase.execute({ postId: 5, page: 1, pageSize: 10 });

    expect(result.items).toHaveLength(0);
    expect(commentQueryService.toView).not.toHaveBeenCalled();
  });
});

// ─── ListBlogFilesUsecase ───

describe('ListBlogFilesUsecase', () => {
  let usecase: ListBlogFilesUsecase;
  let fileQueryService: {
    createFileQueryBuilder: jest.Mock;
    toView: jest.Mock;
  };
  let paginationService: { paginateQuery: jest.Mock };

  beforeEach(() => {
    fileQueryService = {
      createFileQueryBuilder: jest.fn(),
      toView: jest.fn(),
    };
    paginationService = { paginateQuery: jest.fn() };
    usecase = new ListBlogFilesUsecase(
      fileQueryService as unknown as BlogFileQueryService,
      paginationService as unknown as PaginationService,
    );
  });

  it('应编排分页查询并返回文件视图列表', async () => {
    const mockQb = {};
    const mockEntity = { id: 1, originalName: 'test.jpg' };
    const mockView = { id: 1, originalName: 'test.jpg' };
    fileQueryService.createFileQueryBuilder.mockReturnValue(mockQb);
    paginationService.paginateQuery.mockResolvedValue({
      items: [mockEntity],
      total: 1,
      page: 1,
      pageSize: 10,
    });
    fileQueryService.toView.mockReturnValue(mockView);

    const result = await usecase.execute({ page: 1, pageSize: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(mockView);
    expect(result.total).toBe(1);
  });

  it('分页结果为空时不应调用 toView', async () => {
    const mockQb = {};
    fileQueryService.createFileQueryBuilder.mockReturnValue(mockQb);
    paginationService.paginateQuery.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    const result = await usecase.execute({ page: 1, pageSize: 10 });

    expect(result.items).toHaveLength(0);
    expect(fileQueryService.toView).not.toHaveBeenCalled();
  });

  it('应透传 fileType 筛选参数', async () => {
    const mockQb = {};
    fileQueryService.createFileQueryBuilder.mockReturnValue(mockQb);
    paginationService.paginateQuery.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    await usecase.execute({ page: 1, pageSize: 10, fileType: BlogFileType.IMAGE });

    expect(fileQueryService.createFileQueryBuilder).toHaveBeenCalledWith(
      expect.objectContaining({ fileType: 'IMAGE' }),
    );
  });
});

// ─── HasLikedBlogPostUsecase ───

describe('HasLikedBlogPostUsecase', () => {
  let usecase: HasLikedBlogPostUsecase;
  let likeQueryService: { hasLiked: jest.Mock };

  beforeEach(() => {
    likeQueryService = { hasLiked: jest.fn() };
    usecase = new HasLikedBlogPostUsecase(likeQueryService as unknown as BlogLikeQueryService);
  });

  it('已点赞时应返回 true', async () => {
    likeQueryService.hasLiked.mockResolvedValue(true);

    const result = await usecase.execute(1, 'user1');

    expect(result).toBe(true);
  });

  it('未点赞时应返回 false', async () => {
    likeQueryService.hasLiked.mockResolvedValue(false);

    const result = await usecase.execute(1, 'user1');

    expect(result).toBe(false);
  });
});

// ─── GetBlogProfileUsecase ───

describe('GetBlogProfileUsecase', () => {
  let usecase: GetBlogProfileUsecase;
  let profileQueryService: { getProfile: jest.Mock };

  beforeEach(() => {
    profileQueryService = { getProfile: jest.fn() };
    usecase = new GetBlogProfileUsecase(profileQueryService as unknown as BlogProfileQueryService);
  });

  it('存在时应返回博主信息', async () => {
    const profile = { id: 1, nickname: '博主' };
    profileQueryService.getProfile.mockResolvedValue(profile);

    const result = await usecase.execute();

    expect(result).toEqual(profile);
  });

  it('不存在时应返回 null', async () => {
    profileQueryService.getProfile.mockResolvedValue(null);

    const result = await usecase.execute();

    expect(result).toBeNull();
  });
});

// ─── GetBlogDashboardStatsUsecase ───

describe('GetBlogDashboardStatsUsecase', () => {
  let usecase: GetBlogDashboardStatsUsecase;
  let dashboardQueryService: { getDashboardStats: jest.Mock };

  beforeEach(() => {
    dashboardQueryService = { getDashboardStats: jest.fn() };
    usecase = new GetBlogDashboardStatsUsecase(
      dashboardQueryService as unknown as BlogDashboardQueryService,
    );
  });

  it('应委托 QueryService 返回仪表盘统计', async () => {
    const stats = { totalPosts: 10, totalViews: 100 };
    dashboardQueryService.getDashboardStats.mockResolvedValue(stats);

    const result = await usecase.execute();

    expect(result).toEqual(stats);
  });
});
