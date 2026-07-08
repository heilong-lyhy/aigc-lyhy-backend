// src/usecases/blog/blog-read.usecase.spec.ts
// 博客读操作 usecase 单元测试：验证委托调用（分页已下沉到 QueryService）

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
  ListBlogFriendLinksUsecase,
  ListAllBlogFriendLinksUsecase,
} from './blog-read.usecase';
import { BlogPostQueryService } from '@modules/blog/queries/blog-post.query.service';
import { BlogCategoryQueryService } from '@modules/blog/queries/blog-category.query.service';
import { BlogTagQueryService } from '@modules/blog/queries/blog-tag.query.service';
import { BlogCommentQueryService } from '@modules/blog/queries/blog-comment.query.service';
import { BlogLikeQueryService } from '@modules/blog/queries/blog-like.query.service';
import { BlogFileQueryService } from '@modules/blog/queries/blog-file.query.service';
import { BlogProfileQueryService } from '@modules/blog/queries/blog-profile.query.service';
import { BlogDashboardQueryService } from '@modules/blog/queries/blog-dashboard.query.service';
import { BlogFriendLinkQueryService } from '@modules/blog/queries/blog-friend-link.query.service';

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

  beforeEach(() => {
    postQueryService = { findPostBySlug: jest.fn() };
    usecase = new GetBlogPostBySlugUsecase(postQueryService as unknown as BlogPostQueryService);
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

  it('publishedOnly=true 且文章存在时应正常返回', async () => {
    const view = { id: 1, slug: 'test-post', status: BlogPostStatus.PUBLISHED };
    postQueryService.findPostBySlug.mockResolvedValue(view);

    const result = await usecase.execute('test-post', { publishedOnly: true });

    expect(result).toEqual(view);
  });
});

// ─── ListBlogPostsUsecase ───

describe('ListBlogPostsUsecase', () => {
  let usecase: ListBlogPostsUsecase;
  let postQueryService: { paginatePosts: jest.Mock };

  beforeEach(() => {
    postQueryService = { paginatePosts: jest.fn() };
    usecase = new ListBlogPostsUsecase(postQueryService as unknown as BlogPostQueryService);
  });

  it('应委托 QueryService 分页查询并返回结果', async () => {
    const expectedResult = {
      items: [
        { id: 1, title: '文章1' },
        { id: 2, title: '文章2' },
      ],
      total: 2,
      page: 1,
      pageSize: 10,
    };
    postQueryService.paginatePosts.mockResolvedValue(expectedResult);

    const result = await usecase.execute({ page: 1, pageSize: 10 });

    expect(result).toEqual(expectedResult);
    expect(postQueryService.paginatePosts).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
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
  let commentQueryService: { paginateComments: jest.Mock };

  beforeEach(() => {
    commentQueryService = { paginateComments: jest.fn() };
    usecase = new ListBlogCommentsUsecase(
      commentQueryService as unknown as BlogCommentQueryService,
    );
  });

  it('应委托 QueryService 分页查询并返回评论视图列表', async () => {
    const expectedResult = {
      items: [{ id: 1, content: '评论1' }],
      total: 1,
      page: 1,
      pageSize: 10,
    };
    commentQueryService.paginateComments.mockResolvedValue(expectedResult);

    const result = await usecase.execute({ page: 1, pageSize: 10 });

    expect(result).toEqual(expectedResult);
    expect(commentQueryService.paginateComments).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
  });

  it('应透传 postId 和 status 筛选参数', async () => {
    commentQueryService.paginateComments.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    await usecase.execute({ page: 1, pageSize: 10, postId: 5, status: BlogCommentStatus.PENDING });

    expect(commentQueryService.paginateComments).toHaveBeenCalledWith(
      expect.objectContaining({ postId: 5, status: 'PENDING' }),
    );
  });
});

// ─── ListBlogCommentsByPostUsecase ───

describe('ListBlogCommentsByPostUsecase', () => {
  let usecase: ListBlogCommentsByPostUsecase;
  let commentQueryService: { paginateCommentsByPost: jest.Mock };

  beforeEach(() => {
    commentQueryService = { paginateCommentsByPost: jest.fn() };
    usecase = new ListBlogCommentsByPostUsecase(
      commentQueryService as unknown as BlogCommentQueryService,
    );
  });

  it('应委托 QueryService 分页查询并返回评论视图列表', async () => {
    const expectedResult = {
      items: [{ id: 1, content: '公开评论' }],
      total: 1,
      page: 1,
      pageSize: 10,
    };
    commentQueryService.paginateCommentsByPost.mockResolvedValue(expectedResult);

    const result = await usecase.execute({ postId: 5, page: 1, pageSize: 10 });

    expect(result).toEqual(expectedResult);
    expect(commentQueryService.paginateCommentsByPost).toHaveBeenCalledWith({
      postId: 5,
      page: 1,
      pageSize: 10,
    });
  });
});

// ─── ListBlogFilesUsecase ───

describe('ListBlogFilesUsecase', () => {
  let usecase: ListBlogFilesUsecase;
  let fileQueryService: { paginateFiles: jest.Mock };

  beforeEach(() => {
    fileQueryService = { paginateFiles: jest.fn() };
    usecase = new ListBlogFilesUsecase(fileQueryService as unknown as BlogFileQueryService);
  });

  it('应委托 QueryService 分页查询并返回文件视图列表', async () => {
    const expectedResult = {
      items: [{ id: 1, originalName: 'test.jpg' }],
      total: 1,
      page: 1,
      pageSize: 10,
    };
    fileQueryService.paginateFiles.mockResolvedValue(expectedResult);

    const result = await usecase.execute({ page: 1, pageSize: 10 });

    expect(result).toEqual(expectedResult);
    expect(fileQueryService.paginateFiles).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
  });

  it('应透传 fileType 筛选参数', async () => {
    fileQueryService.paginateFiles.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });

    await usecase.execute({ page: 1, pageSize: 10, fileType: BlogFileType.IMAGE });

    expect(fileQueryService.paginateFiles).toHaveBeenCalledWith(
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

// ─── ListBlogFriendLinksUsecase ───

describe('ListBlogFriendLinksUsecase', () => {
  let usecase: ListBlogFriendLinksUsecase;
  let friendLinkQueryService: { listActiveFriendLinks: jest.Mock };

  beforeEach(() => {
    friendLinkQueryService = { listActiveFriendLinks: jest.fn() };
    usecase = new ListBlogFriendLinksUsecase(
      friendLinkQueryService as unknown as BlogFriendLinkQueryService,
    );
  });

  it('应仅返回启用的友链', async () => {
    const views = [{ id: 1, name: '友链1', isActive: true }];
    friendLinkQueryService.listActiveFriendLinks.mockResolvedValue(views);

    const result = await usecase.execute();

    expect(result).toEqual(views);
    expect(friendLinkQueryService.listActiveFriendLinks).toHaveBeenCalled();
  });
});

// ─── ListAllBlogFriendLinksUsecase ───

describe('ListAllBlogFriendLinksUsecase', () => {
  let usecase: ListAllBlogFriendLinksUsecase;
  let friendLinkQueryService: { listAllFriendLinks: jest.Mock };

  beforeEach(() => {
    friendLinkQueryService = { listAllFriendLinks: jest.fn() };
    usecase = new ListAllBlogFriendLinksUsecase(
      friendLinkQueryService as unknown as BlogFriendLinkQueryService,
    );
  });

  it('应返回所有友链（含禁用项）', async () => {
    const views = [
      { id: 1, name: '友链1', isActive: true },
      { id: 2, name: '友链2', isActive: false },
    ];
    friendLinkQueryService.listAllFriendLinks.mockResolvedValue(views);

    const result = await usecase.execute();

    expect(result).toEqual(views);
    expect(friendLinkQueryService.listAllFriendLinks).toHaveBeenCalled();
  });
});
