// test/09-blog/blog-query-integration.e2e-spec.ts
// 博客 QueryService 集成测试：验证分页查询、搜索、树形分类查询
// 使用真实数据库，通过 NestJS 测试模块验证 QueryService 与 ORM 的协作

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { useContainer } from 'class-validator';
import { DataSource } from 'typeorm';
import { ApiModule } from '../../src/bootstraps/api/api.module';
import { BlogPostService } from '../../src/modules/blog/blog-post.service';
import { BlogCategoryService } from '../../src/modules/blog/blog-category.service';
import { BlogTagService } from '../../src/modules/blog/blog-tag.service';
import { BlogCommentService } from '../../src/modules/blog/blog-comment.service';
import { BlogPostQueryService } from '../../src/modules/blog/queries/blog-post.query.service';
import { BlogCategoryQueryService } from '../../src/modules/blog/queries/blog-category.query.service';
import { BlogTagQueryService } from '../../src/modules/blog/queries/blog-tag.query.service';
import { BlogCommentQueryService } from '../../src/modules/blog/queries/blog-comment.query.service';
import { BlogPostStatus, BlogCommentStatus } from '@app-types/models/blog.types';
import { PaginationService } from '../../src/modules/common/pagination.service';
import { initGraphQLSchema } from '../../src/adapters/api/graphql/schema/schema.init';

describe('Blog QueryService Integration (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let postService: BlogPostService;
  let categoryService: BlogCategoryService;
  let tagService: BlogTagService;
  let commentService: BlogCommentService;
  let postQueryService: BlogPostQueryService;
  let categoryQueryService: BlogCategoryQueryService;
  let tagQueryService: BlogTagQueryService;
  let commentQueryService: BlogCommentQueryService;
  let paginationService: PaginationService;

  beforeAll(async () => {
    initGraphQLSchema();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ApiModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    useContainer(app.select(ApiModule), { fallbackOnErrors: true });
    dataSource = moduleFixture.get<DataSource>(DataSource);

    postService = moduleFixture.get<BlogPostService>(BlogPostService);
    categoryService = moduleFixture.get<BlogCategoryService>(BlogCategoryService);
    tagService = moduleFixture.get<BlogTagService>(BlogTagService);
    commentService = moduleFixture.get<BlogCommentService>(BlogCommentService);
    postQueryService = moduleFixture.get<BlogPostQueryService>(BlogPostQueryService);
    categoryQueryService = moduleFixture.get<BlogCategoryQueryService>(BlogCategoryQueryService);
    tagQueryService = moduleFixture.get<BlogTagQueryService>(BlogTagQueryService);
    commentQueryService = moduleFixture.get<BlogCommentQueryService>(BlogCommentQueryService);
    paginationService = moduleFixture.get<PaginationService>(PaginationService);

    await app.init();
  }, 30000);

  afterAll(async () => {
    try {
      if (dataSource && dataSource.isInitialized) {
        await cleanupBlogTables();
      }
    } finally {
      if (app) {
        await app.close();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  });

  beforeEach(async () => {
    await cleanupBlogTables();
  });

  const cleanupBlogTables = async (): Promise<void> => {
    if (!dataSource || !dataSource.isInitialized) return;
    const tables = [
      'blog_like',
      'blog_comment',
      'blog_post_tag',
      'blog_post',
      'blog_tag',
      'blog_category',
      'blog_file',
      'blog_profile',
    ];
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of tables) {
      await dataSource.query(`TRUNCATE TABLE \`${table}\``);
    }
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
  };

  // ─── 树形分类查询 ───

  describe('树形分类查询', () => {
    it('应正确构建多层分类树', async () => {
      const root1 = await categoryService.createCategory({ name: '技术', slug: 'tech' });
      await categoryService.createCategory({ name: '生活', slug: 'life' });
      const child1 = await categoryService.createCategory({
        name: '前端',
        slug: 'frontend',
        parentId: root1.id,
      });
      await categoryService.createCategory({
        name: '后端',
        slug: 'backend',
        parentId: root1.id,
      });
      const grandchild = await categoryService.createCategory({
        name: 'React',
        slug: 'react',
        parentId: child1.id,
      });

      const tree = await categoryQueryService.getCategoryTree();

      expect(tree).toHaveLength(2);
      const techNode = tree.find((n) => n.id === root1.id);
      expect(techNode).toBeDefined();
      expect(techNode!.children).toHaveLength(2);
      const frontendNode = techNode!.children.find((n) => n.id === child1.id);
      expect(frontendNode).toBeDefined();
      expect(frontendNode!.children).toHaveLength(1);
      expect(frontendNode!.children[0].id).toBe(grandchild.id);
    });

    it('分类树中 postCount 应正确统计', async () => {
      const cat = await categoryService.createCategory({ name: '技术', slug: 'tech' });
      await postService.createPost({
        title: '文章1',
        slug: 'post-1',
        content: '内容',
        categoryId: cat.id,
        status: BlogPostStatus.PUBLISHED,
      });
      await postService.createPost({
        title: '文章2',
        slug: 'post-2',
        content: '内容',
        categoryId: cat.id,
        status: BlogPostStatus.DRAFT,
      });

      const tree = await categoryQueryService.getCategoryTree();

      expect(tree).toHaveLength(1);
      expect(tree[0].postCount).toBe(2);
    });
  });

  // ─── 分页查询 ───

  describe('文章分页查询', () => {
    beforeEach(async () => {
      const cat = await categoryService.createCategory({ name: '技术', slug: 'tech' });
      for (let i = 1; i <= 15; i++) {
        await postService.createPost({
          title: `文章${String(i).padStart(2, '0')}`,
          slug: `post-${String(i).padStart(2, '0')}`,
          content: `内容${i}`,
          categoryId: cat.id,
          status: i <= 10 ? BlogPostStatus.PUBLISHED : BlogPostStatus.DRAFT,
        });
      }
    });

    it('应返回第 1 页数据', async () => {
      const qb = postQueryService.createPostQueryBuilder({
        page: 1,
        pageSize: 5,
        status: BlogPostStatus.PUBLISHED,
      });

      const result = await paginationService.paginateQuery({
        qb,
        params: {
          mode: 'OFFSET',
          page: 1,
          pageSize: 5,
          withTotal: true,
          sorts: [{ field: 'createdAt', direction: 'DESC' }],
        },
        allowedSorts: ['createdAt'],
        defaultSorts: [{ field: 'createdAt', direction: 'DESC' }],
        resolveColumn: (field) => (field === 'createdAt' ? 'post.created_at' : null),
      });

      expect(result.items).toHaveLength(5);
      expect(result.total).toBe(10);
      expect(result.page).toBe(1);
    });

    it('应返回第 2 页数据', async () => {
      const qb = postQueryService.createPostQueryBuilder({
        page: 2,
        pageSize: 5,
        status: BlogPostStatus.PUBLISHED,
      });

      const result = await paginationService.paginateQuery({
        qb,
        params: {
          mode: 'OFFSET',
          page: 2,
          pageSize: 5,
          withTotal: true,
          sorts: [{ field: 'createdAt', direction: 'DESC' }],
        },
        allowedSorts: ['createdAt'],
        defaultSorts: [{ field: 'createdAt', direction: 'DESC' }],
        resolveColumn: (field) => (field === 'createdAt' ? 'post.created_at' : null),
      });

      expect(result.items).toHaveLength(5);
      expect(result.total).toBe(10);
      expect(result.page).toBe(2);
    });

    it('超出范围时应返回空列表', async () => {
      const qb = postQueryService.createPostQueryBuilder({
        page: 10,
        pageSize: 5,
        status: BlogPostStatus.PUBLISHED,
      });

      const result = await paginationService.paginateQuery({
        qb,
        params: {
          mode: 'OFFSET',
          page: 10,
          pageSize: 5,
          withTotal: true,
          sorts: [{ field: 'createdAt', direction: 'DESC' }],
        },
        allowedSorts: ['createdAt'],
        defaultSorts: [{ field: 'createdAt', direction: 'DESC' }],
        resolveColumn: (field) => (field === 'createdAt' ? 'post.created_at' : null),
      });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(10);
    });
  });

  // ─── 搜索查询 ───

  describe('文章搜索查询', () => {
    beforeEach(async () => {
      await postService.createPost({
        title: 'NestJS 分层架构',
        slug: 'nestjs-architecture',
        content: '探讨分层架构',
        status: BlogPostStatus.PUBLISHED,
      });
      await postService.createPost({
        title: 'React 18 新特性',
        slug: 'react-18',
        content: 'React 18 并发特性',
        status: BlogPostStatus.PUBLISHED,
      });
      await postService.createPost({
        title: 'GraphQL 实践',
        slug: 'graphql-practice',
        content: 'GraphQL 与 REST 对比',
        status: BlogPostStatus.PUBLISHED,
      });
    });

    it('按标题搜索应返回匹配结果', async () => {
      const qb = postQueryService.createPostQueryBuilder({
        page: 1,
        pageSize: 10,
        status: BlogPostStatus.PUBLISHED,
        title: 'NestJS',
      });

      const result = await paginationService.paginateQuery({
        qb,
        params: {
          mode: 'OFFSET',
          page: 1,
          pageSize: 10,
          withTotal: true,
          sorts: [{ field: 'createdAt', direction: 'DESC' }],
        },
        allowedSorts: ['createdAt'],
        defaultSorts: [{ field: 'createdAt', direction: 'DESC' }],
        resolveColumn: (field) => (field === 'createdAt' ? 'post.created_at' : null),
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('无匹配时应返回空结果', async () => {
      const qb = postQueryService.createPostQueryBuilder({
        page: 1,
        pageSize: 10,
        status: BlogPostStatus.PUBLISHED,
        title: '不存在的关键词',
      });

      const result = await paginationService.paginateQuery({
        qb,
        params: {
          mode: 'OFFSET',
          page: 1,
          pageSize: 10,
          withTotal: true,
          sorts: [{ field: 'createdAt', direction: 'DESC' }],
        },
        allowedSorts: ['createdAt'],
        defaultSorts: [{ field: 'createdAt', direction: 'DESC' }],
        resolveColumn: (field) => (field === 'createdAt' ? 'post.created_at' : null),
      });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('按分类筛选应返回正确结果', async () => {
      const cat = await categoryService.createCategory({ name: '技术', slug: 'tech' });
      await postService.createPost({
        title: '分类文章',
        slug: 'categorized-post',
        content: '内容',
        categoryId: cat.id,
        status: BlogPostStatus.PUBLISHED,
      });

      const qb = postQueryService.createPostQueryBuilder({
        page: 1,
        pageSize: 10,
        status: BlogPostStatus.PUBLISHED,
        categoryId: cat.id,
      });

      const result = await paginationService.paginateQuery({
        qb,
        params: {
          mode: 'OFFSET',
          page: 1,
          pageSize: 10,
          withTotal: true,
          sorts: [{ field: 'createdAt', direction: 'DESC' }],
        },
        allowedSorts: ['createdAt'],
        defaultSorts: [{ field: 'createdAt', direction: 'DESC' }],
        resolveColumn: (field) => (field === 'createdAt' ? 'post.created_at' : null),
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ─── 评论分页查询 ───

  describe('评论分页查询', () => {
    let postId: number;

    beforeEach(async () => {
      const post = await postService.createPost({
        title: '评论测试文章',
        slug: 'comment-test-post',
        content: '内容',
        status: BlogPostStatus.PUBLISHED,
      });
      postId = post!.id;

      // 创建多条评论
      for (let i = 1; i <= 8; i++) {
        const comment = await commentService.createComment({
          postId,
          authorName: `访客${i}`,
          authorEmail: `visitor${i}@example.com`,
          content: `评论内容${i}`,
        });
        // 批准部分评论
        if (i <= 5) {
          await commentService.updateCommentStatus({
            id: comment.id,
            status: BlogCommentStatus.APPROVED,
          });
        }
      }
    });

    it('公开查询应只返回已审核通过的评论', async () => {
      const comments = await commentQueryService.listCommentsByPostId(postId);

      expect(comments).toHaveLength(5);
      comments.forEach((c) => expect(c.status).toBe(BlogCommentStatus.APPROVED));
    });

    it('管理端查询应返回所有评论', async () => {
      const comments = await commentQueryService.listAllComments();

      expect(comments).toHaveLength(8);
    });

    it('应正确统计待审核评论数', async () => {
      const count = await commentQueryService.countPendingComments();

      expect(count).toBe(3);
    });
  });

  // ─── 标签查询 ───

  describe('标签查询', () => {
    it('应返回所有标签及 postCount', async () => {
      const tag1 = await tagService.createTag({ name: 'TypeScript', slug: 'typescript' });
      const tag2 = await tagService.createTag({ name: 'NestJS', slug: 'nestjs' });

      const post = await postService.createPost({
        title: '带标签文章',
        slug: 'tagged-post',
        content: '内容',
        tagIds: [tag1.id],
        status: BlogPostStatus.PUBLISHED,
      });

      const view = await postQueryService.findPostById(post!.id);
      expect(view).not.toBeNull();
      expect(view!.tags).toHaveLength(1);
      expect(view!.tags[0].id).toBe(tag1.id);

      const tagView = await tagQueryService.findTagById(tag2.id);
      expect(tagView).not.toBeNull();
      expect(tagView!.postCount).toBe(0);
    });
  });
});
