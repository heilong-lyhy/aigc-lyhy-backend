// test/09-blog/blog-graphql.e2e-spec.ts
// 博客 GraphQL e2e 测试：覆盖文章 CRUD、评论提交与审核、点赞

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { useContainer } from 'class-validator';
import { DataSource } from 'typeorm';
import { ApiModule } from '../../src/bootstraps/api/api.module';
import { initGraphQLSchema } from '../../src/adapters/api/graphql/schema/schema.init';
import { login, postGql } from '../utils/e2e-graphql-utils';
import { cleanupTestAccounts, seedTestAccounts, testAccountsConfig } from '../utils/test-accounts';

describe('Blog GraphQL (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;

  const { admin } = testAccountsConfig;

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

  beforeAll(async () => {
    initGraphQLSchema();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ApiModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    useContainer(app.select(ApiModule), { fallbackOnErrors: true });
    dataSource = moduleFixture.get<DataSource>(DataSource);

    await app.init();

    // 创建管理员账号并登录
    await cleanupTestAccounts(dataSource);
    await seedTestAccounts({ dataSource, includeKeys: ['admin'] });
    adminToken = await login({
      app,
      loginName: admin.loginName,
      loginPassword: admin.loginPassword,
    });
  }, 30000);

  afterAll(async () => {
    try {
      if (dataSource && dataSource.isInitialized) {
        await cleanupBlogTables();
        await cleanupTestAccounts(dataSource);
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

  // ─── 文章 CRUD ───

  describe('文章 CRUD', () => {
    it('应创建文章', async () => {
      const res = await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) {
              id
              title
              slug
              status
            }
          }
        `,
        variables: {
          input: {
            title: 'GraphQL 测试文章',
            slug: 'graphql-test-post',
            content: '通过 GraphQL 创建的文章内容',
          },
        },
        token: adminToken,
      }).expect(200);

      const body = res.body as {
        data: { createBlogPost: { id: number; title: string; slug: string; status: string } };
      };
      expect(body.data.createBlogPost.title).toBe('GraphQL 测试文章');
      expect(body.data.createBlogPost.slug).toBe('graphql-test-post');
      expect(body.data.createBlogPost.id).toBeDefined();
    });

    it('应更新文章', async () => {
      // 先创建
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) {
              id
              title
            }
          }
        `,
        variables: {
          input: {
            title: '旧标题',
            slug: 'old-title',
            content: '内容',
          },
        },
        token: adminToken,
      }).expect(200);

      const postId = (createRes.body as { data: { createBlogPost: { id: number } } }).data
        .createBlogPost.id;

      // 更新
      const updateRes = await postGql({
        app,
        query: `
          mutation UpdateBlogPost($input: UpdateBlogPostInput!) {
            updateBlogPost(input: $input) {
              id
              title
            }
          }
        `,
        variables: {
          input: {
            id: postId,
            title: '新标题',
          },
        },
        token: adminToken,
      }).expect(200);

      const body = updateRes.body as { data: { updateBlogPost: { id: number; title: string } } };
      expect(body.data.updateBlogPost.title).toBe('新标题');
    });

    it('应发布文章', async () => {
      // 创建草稿
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) {
              id
              status
            }
          }
        `,
        variables: {
          input: {
            title: '待发布文章',
            slug: 'to-publish',
            content: '内容',
          },
        },
        token: adminToken,
      }).expect(200);

      const postId = (createRes.body as { data: { createBlogPost: { id: number } } }).data
        .createBlogPost.id;

      // 发布
      const publishRes = await postGql({
        app,
        query: `
          mutation PublishBlogPost($id: Int!) {
            publishBlogPost(id: $id) {
              id
              status
              publishedAt
            }
          }
        `,
        variables: { id: postId },
        token: adminToken,
      }).expect(200);

      const body = publishRes.body as {
        data: { publishBlogPost: { id: number; status: string; publishedAt: string } };
      };
      expect(body.data.publishBlogPost.status).toBe('PUBLISHED');
      expect(body.data.publishBlogPost.publishedAt).toBeDefined();
    });

    it('应删除文章', async () => {
      // 创建
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) { id }
          }
        `,
        variables: {
          input: {
            title: '待删除文章',
            slug: 'to-delete',
            content: '内容',
          },
        },
        token: adminToken,
      }).expect(200);

      const postId = (createRes.body as { data: { createBlogPost: { id: number } } }).data
        .createBlogPost.id;

      // 删除
      const deleteRes = await postGql({
        app,
        query: `
          mutation DeleteBlogPost($id: Int!) {
            deleteBlogPost(id: $id)
          }
        `,
        variables: { id: postId },
        token: adminToken,
      }).expect(200);

      const body = deleteRes.body as { data: { deleteBlogPost: boolean } };
      expect(body.data.deleteBlogPost).toBe(true);
    });

    it('应查询已发布文章列表', async () => {
      // 创建并发布文章
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) { id }
          }
        `,
        variables: {
          input: {
            title: '已发布文章',
            slug: 'published-post',
            content: '内容',
            status: 'PUBLISHED',
          },
        },
        token: adminToken,
      }).expect(200);

      const postId = (createRes.body as { data: { createBlogPost: { id: number } } }).data
        .createBlogPost.id;

      // 发布
      await postGql({
        app,
        query: `
          mutation PublishBlogPost($id: Int!) {
            publishBlogPost(id: $id) { id }
          }
        `,
        variables: { id: postId },
        token: adminToken,
      }).expect(200);

      // 查询已发布列表
      const listRes = await postGql({
        app,
        query: `
          query BlogPublishedPosts {
            blogPublishedPosts(page: 1, limit: 10) {
              list { id title slug }
              current
              pageSize
              total
            }
          }
        `,
      }).expect(200);

      const body = listRes.body as {
        data: { blogPublishedPosts: { list: Array<{ id: number; title: string }>; total: number } };
      };
      expect(body.data.blogPublishedPosts.list.length).toBeGreaterThanOrEqual(1);
      expect(body.data.blogPublishedPosts.total).toBeGreaterThanOrEqual(1);
    });

    it('未认证用户不能创建文章', async () => {
      const res = await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) { id }
          }
        `,
        variables: {
          input: {
            title: '未认证文章',
            slug: 'unauth-post',
            content: '内容',
          },
        },
      });

      const body = res.body as { errors?: Array<{ message: string }> };
      expect(body.errors).toBeDefined();
      expect(res.status).toBe(200); // GraphQL 返回 200 但有 errors
    });
  });

  // ─── 评论提交与审核 ───

  describe('评论提交与审核', () => {
    let publishedPostId: number;

    beforeEach(async () => {
      // 创建并发布一篇文章
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) { id }
          }
        `,
        variables: {
          input: {
            title: '评论测试文章',
            slug: 'comment-test-post',
            content: '内容',
            status: 'PUBLISHED',
          },
        },
        token: adminToken,
      }).expect(200);

      publishedPostId = (createRes.body as { data: { createBlogPost: { id: number } } }).data
        .createBlogPost.id;

      await postGql({
        app,
        query: `
          mutation PublishBlogPost($id: Int!) {
            publishBlogPost(id: $id) { id }
          }
        `,
        variables: { id: publishedPostId },
        token: adminToken,
      }).expect(200);
    });

    it('应提交评论', async () => {
      const res = await postGql({
        app,
        query: `
          mutation CreateBlogComment($input: CreateBlogCommentInput!) {
            createBlogComment(input: $input) {
              id
              postId
              authorName
              content
              status
            }
          }
        `,
        variables: {
          input: {
            postId: publishedPostId,
            authorName: '测试访客',
            authorEmail: 'visitor@example.com',
            content: '这是一条评论',
          },
        },
      }).expect(200);

      const body = res.body as {
        data: {
          createBlogComment: { id: number; authorName: string; content: string; status: string };
        };
      };
      expect(body.data.createBlogComment.authorName).toBe('测试访客');
      expect(body.data.createBlogComment.content).toBe('这是一条评论');
      expect(body.data.createBlogComment.status).toBe('PENDING');
    });

    it('应审核评论（批准）', async () => {
      // 创建评论
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogComment($input: CreateBlogCommentInput!) {
            createBlogComment(input: $input) { id }
          }
        `,
        variables: {
          input: {
            postId: publishedPostId,
            authorName: '访客',
            authorEmail: 'visitor2@example.com',
            content: '待审核评论',
          },
        },
      }).expect(200);

      const commentId = (createRes.body as { data: { createBlogComment: { id: number } } }).data
        .createBlogComment.id;

      // 审核批准
      const approveRes = await postGql({
        app,
        query: `
          mutation UpdateBlogCommentStatus($input: UpdateBlogCommentStatusInput!) {
            updateBlogCommentStatus(input: $input) {
              id
              status
            }
          }
        `,
        variables: {
          input: {
            id: commentId,
            status: 'APPROVED',
          },
        },
        token: adminToken,
      }).expect(200);

      const body = approveRes.body as {
        data: { updateBlogCommentStatus: { id: number; status: string } };
      };
      expect(body.data.updateBlogCommentStatus.status).toBe('APPROVED');
    });

    it('应审核评论（拒绝）', async () => {
      // 创建评论
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogComment($input: CreateBlogCommentInput!) {
            createBlogComment(input: $input) { id }
          }
        `,
        variables: {
          input: {
            postId: publishedPostId,
            authorName: '垃圾评论者',
            authorEmail: 'spammer@example.com',
            content: '垃圾评论',
          },
        },
      }).expect(200);

      const commentId = (createRes.body as { data: { createBlogComment: { id: number } } }).data
        .createBlogComment.id;

      // 拒绝
      const rejectRes = await postGql({
        app,
        query: `
          mutation UpdateBlogCommentStatus($input: UpdateBlogCommentStatusInput!) {
            updateBlogCommentStatus(input: $input) {
              id
              status
            }
          }
        `,
        variables: {
          input: {
            id: commentId,
            status: 'REJECTED',
          },
        },
        token: adminToken,
      }).expect(200);

      const body = rejectRes.body as {
        data: { updateBlogCommentStatus: { id: number; status: string } };
      };
      expect(body.data.updateBlogCommentStatus.status).toBe('REJECTED');
    });

    it('未认证用户不能审核评论', async () => {
      const res = await postGql({
        app,
        query: `
          mutation UpdateBlogCommentStatus($input: UpdateBlogCommentStatusInput!) {
            updateBlogCommentStatus(input: $input) { id }
          }
        `,
        variables: {
          input: {
            id: 1,
            status: 'APPROVED',
          },
        },
      });

      const body = res.body as { errors?: Array<{ message: string }> };
      expect(body.errors).toBeDefined();
    });
  });

  // ─── 点赞 ───

  describe('点赞', () => {
    let publishedPostId: number;

    beforeEach(async () => {
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) { id }
          }
        `,
        variables: {
          input: {
            title: '点赞测试文章',
            slug: 'like-test-post',
            content: '内容',
            status: 'PUBLISHED',
          },
        },
        token: adminToken,
      }).expect(200);

      publishedPostId = (createRes.body as { data: { createBlogPost: { id: number } } }).data
        .createBlogPost.id;

      await postGql({
        app,
        query: `
          mutation PublishBlogPost($id: Int!) {
            publishBlogPost(id: $id) { id }
          }
        `,
        variables: { id: publishedPostId },
        token: adminToken,
      }).expect(200);
    });

    it('应点赞文章', async () => {
      const res = await postGql({
        app,
        query: `
          mutation ToggleBlogPostLike($postId: Int!, $userIdentifier: String!) {
            toggleBlogPostLike(postId: $postId, userIdentifier: $userIdentifier)
          }
        `,
        variables: {
          postId: publishedPostId,
          userIdentifier: 'user:1',
        },
      }).expect(200);

      const body = res.body as { data: { toggleBlogPostLike: boolean } };
      expect(body.data.toggleBlogPostLike).toBe(true);
    });

    it('应取消点赞文章', async () => {
      // 先点赞
      await postGql({
        app,
        query: `
          mutation ToggleBlogPostLike($postId: Int!, $userIdentifier: String!) {
            toggleBlogPostLike(postId: $postId, userIdentifier: $userIdentifier)
          }
        `,
        variables: {
          postId: publishedPostId,
          userIdentifier: 'user:2',
        },
      }).expect(200);

      // 再取消
      const res = await postGql({
        app,
        query: `
          mutation ToggleBlogPostLike($postId: Int!, $userIdentifier: String!) {
            toggleBlogPostLike(postId: $postId, userIdentifier: $userIdentifier)
          }
        `,
        variables: {
          postId: publishedPostId,
          userIdentifier: 'user:2',
        },
      }).expect(200);

      const body = res.body as { data: { toggleBlogPostLike: boolean } };
      expect(body.data.toggleBlogPostLike).toBe(false);
    });

    it('应查询用户是否已点赞', async () => {
      // 先点赞
      await postGql({
        app,
        query: `
          mutation ToggleBlogPostLike($postId: Int!, $userIdentifier: String!) {
            toggleBlogPostLike(postId: $postId, userIdentifier: $userIdentifier)
          }
        `,
        variables: {
          postId: publishedPostId,
          userIdentifier: 'user:3',
        },
      }).expect(200);

      // 查询已点赞
      const likedRes = await postGql({
        app,
        query: `
          query HasLikedBlogPost($postId: Int!, $userIdentifier: String!) {
            hasLikedBlogPost(postId: $postId, userIdentifier: $userIdentifier)
          }
        `,
        variables: {
          postId: publishedPostId,
          userIdentifier: 'user:3',
        },
      }).expect(200);

      const likedBody = likedRes.body as { data: { hasLikedBlogPost: boolean } };
      expect(likedBody.data.hasLikedBlogPost).toBe(true);

      // 查询未点赞
      const notLikedRes = await postGql({
        app,
        query: `
          query HasLikedBlogPost($postId: Int!, $userIdentifier: String!) {
            hasLikedBlogPost(postId: $postId, userIdentifier: $userIdentifier)
          }
        `,
        variables: {
          postId: publishedPostId,
          userIdentifier: 'user:4',
        },
      }).expect(200);

      const notLikedBody = notLikedRes.body as { data: { hasLikedBlogPost: boolean } };
      expect(notLikedBody.data.hasLikedBlogPost).toBe(false);
    });
  });

  // ─── 错误路径 ───

  describe('错误路径', () => {
    it('重复 slug 创建文章应返回错误', async () => {
      // 先创建一篇文章
      await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) { id }
          }
        `,
        variables: {
          input: { title: '第一篇', slug: 'duplicate-slug', content: '内容' },
        },
        token: adminToken,
      }).expect(200);

      // 再用相同 slug 创建
      const res = await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) { id }
          }
        `,
        variables: {
          input: { title: '第二篇', slug: 'duplicate-slug', content: '内容' },
        },
        token: adminToken,
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string } }>;
      };
      expect(body.errors).toBeDefined();
    });

    it('删除不存在的文章应返回错误', async () => {
      const res = await postGql({
        app,
        query: `
          mutation DeleteBlogPost($id: Int!) {
            deleteBlogPost(id: $id)
          }
        `,
        variables: { id: 99999 },
        token: adminToken,
      });

      const body = res.body as { errors?: Array<{ message: string }> };
      expect(body.errors).toBeDefined();
    });

    it('发布已发布文章应返回错误', async () => {
      // 创建并发布
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) { id }
          }
        `,
        variables: {
          input: {
            title: '已发布',
            slug: 'already-published',
            content: '内容',
            status: 'PUBLISHED',
          },
        },
        token: adminToken,
      }).expect(200);

      const postId = (createRes.body as { data: { createBlogPost: { id: number } } }).data
        .createBlogPost.id;

      await postGql({
        app,
        query: `
          mutation PublishBlogPost($id: Int!) {
            publishBlogPost(id: $id) { id }
          }
        `,
        variables: { id: postId },
        token: adminToken,
      }).expect(200);

      // 再次发布
      const res = await postGql({
        app,
        query: `
          mutation PublishBlogPost($id: Int!) {
            publishBlogPost(id: $id) { id }
          }
        `,
        variables: { id: postId },
        token: adminToken,
      });

      const body = res.body as { errors?: Array<{ message: string }> };
      expect(body.errors).toBeDefined();
    });

    it('创建分类重复 slug 应返回错误', async () => {
      await postGql({
        app,
        query: `
          mutation CreateBlogCategory($input: CreateBlogCategoryInput!) {
            createBlogCategory(input: $input) { id }
          }
        `,
        variables: { input: { name: '技术', slug: 'tech' } },
        token: adminToken,
      }).expect(200);

      const res = await postGql({
        app,
        query: `
          mutation CreateBlogCategory($input: CreateBlogCategoryInput!) {
            createBlogCategory(input: $input) { id }
          }
        `,
        variables: { input: { name: '技术2', slug: 'tech' } },
        token: adminToken,
      });

      const body = res.body as { errors?: Array<{ message: string }> };
      expect(body.errors).toBeDefined();
    });

    it('删除有文章的分类应返回错误', async () => {
      // 创建分类
      const catRes = await postGql({
        app,
        query: `
          mutation CreateBlogCategory($input: CreateBlogCategoryInput!) {
            createBlogCategory(input: $input) { id }
          }
        `,
        variables: { input: { name: '技术', slug: 'tech' } },
        token: adminToken,
      }).expect(200);

      const categoryId = (catRes.body as { data: { createBlogCategory: { id: number } } }).data
        .createBlogCategory.id;

      // 创建文章并关联分类
      await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) { id }
          }
        `,
        variables: {
          input: { title: '分类文章', slug: 'categorized', content: '内容', categoryId },
        },
        token: adminToken,
      }).expect(200);

      // 尝试删除有文章的分类
      const res = await postGql({
        app,
        query: `
          mutation DeleteBlogCategory($id: Int!) {
            deleteBlogCategory(id: $id)
          }
        `,
        variables: { id: categoryId },
        token: adminToken,
      });

      const body = res.body as { errors?: Array<{ message: string }> };
      expect(body.errors).toBeDefined();
    });

    it('创建标签重复 slug 应返回错误', async () => {
      await postGql({
        app,
        query: `
          mutation CreateBlogTag($input: CreateBlogTagInput!) {
            createBlogTag(input: $input) { id }
          }
        `,
        variables: { input: { name: 'TypeScript', slug: 'typescript' } },
        token: adminToken,
      }).expect(200);

      const res = await postGql({
        app,
        query: `
          mutation CreateBlogTag($input: CreateBlogTagInput!) {
            createBlogTag(input: $input) { id }
          }
        `,
        variables: { input: { name: 'TS', slug: 'typescript' } },
        token: adminToken,
      });

      const body = res.body as { errors?: Array<{ message: string }> };
      expect(body.errors).toBeDefined();
    });
  });
});
