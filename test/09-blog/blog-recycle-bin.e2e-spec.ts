// test/09-blog/blog-recycle-bin.e2e-spec.ts
// 博客回收站 e2e 测试：覆盖软删除 → 回收站列表 → 恢复 → 永久删除完整流程

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { useContainer } from 'class-validator';
import { DataSource } from 'typeorm';
import { ApiModule } from '../../src/bootstraps/api/api.module';
import { initGraphQLSchema } from '../../src/adapters/api/graphql/schema/schema.init';
import { login, postGql } from '../utils/e2e-graphql-utils';
import { cleanupTestAccounts, seedTestAccounts, testAccountsConfig } from '../utils/test-accounts';

describe('Blog Recycle Bin (e2e)', () => {
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
      try {
        await dataSource.query(`TRUNCATE TABLE \`${table}\``);
      } catch {
        // 表不存在时忽略
      }
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

  // ─── 回收站完整流程 ───

  describe('回收站流程', () => {
    it('应完成 软删除 → 回收站列表 → 恢复 → 再删除 → 永久删除 完整流程', async () => {
      // 1. 创建文章
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) { id title }
          }
        `,
        variables: {
          input: { title: '回收站测试', slug: 'recycle-test', content: '内容' },
        },
        token: adminToken,
      }).expect(200);

      const postId = Number(
        (createRes.body as { data: { createBlogPost: { id: number } } }).data.createBlogPost.id,
      );

      // 2. 软删除文章
      const deleteRes = await postGql({
        app,
        query: `mutation DeleteBlogPost($id: Int!) { deleteBlogPost(id: $id) }`,
        variables: { id: postId },
        token: adminToken,
      }).expect(200);

      expect((deleteRes.body as { data: { deleteBlogPost: boolean } }).data.deleteBlogPost).toBe(
        true,
      );

      // 3. 回收站列表应包含已删除文章
      const deletedListRes = await postGql({
        app,
        query: `
          query BlogDeletedPosts($page: Int!, $limit: Int!) {
            blogDeletedPosts(page: $page, limit: $limit) {
              list { id title }
              total
            }
          }
        `,
        variables: { page: 1, limit: 10 },
        token: adminToken,
      }).expect(200);

      const deletedList = (
        deletedListRes.body as {
          data: { blogDeletedPosts: { list: Array<{ id: number; title: string }>; total: number } };
        }
      ).data.blogDeletedPosts;
      expect(deletedList.total).toBe(1);
      expect(Number(deletedList.list[0].id)).toBe(postId);

      // 4. 恢复文章
      const restoreRes = await postGql({
        app,
        query: `mutation RestoreBlogPost($id: Int!) { restoreBlogPost(id: $id) { id title } }`,
        variables: { id: postId },
        token: adminToken,
      }).expect(200);

      const restored = (
        restoreRes.body as {
          data: { restoreBlogPost: { id: number; title: string } };
        }
      ).data.restoreBlogPost;
      expect(Number(restored.id)).toBe(postId);

      // 5. 回收站列表应为空
      const emptyDeletedRes = await postGql({
        app,
        query: `
          query BlogDeletedPosts($page: Int!, $limit: Int!) {
            blogDeletedPosts(page: $page, limit: $limit) { total }
          }
        `,
        variables: { page: 1, limit: 10 },
        token: adminToken,
      }).expect(200);

      expect(
        (emptyDeletedRes.body as { data: { blogDeletedPosts: { total: number } } }).data
          .blogDeletedPosts.total,
      ).toBe(0);

      // 6. 再次软删除
      await postGql({
        app,
        query: `mutation DeleteBlogPost($id: Int!) { deleteBlogPost(id: $id) }`,
        variables: { id: postId },
        token: adminToken,
      }).expect(200);

      // 7. 永久删除
      const permanentDeleteRes = await postGql({
        app,
        query: `mutation PermanentDeleteBlogPost($id: Int!) { permanentDeleteBlogPost(id: $id) }`,
        variables: { id: postId },
        token: adminToken,
      }).expect(200);

      expect(
        (permanentDeleteRes.body as { data: { permanentDeleteBlogPost: boolean } }).data
          .permanentDeleteBlogPost,
      ).toBe(true);

      // 8. 回收站列表应为空
      const finalDeletedRes = await postGql({
        app,
        query: `
          query BlogDeletedPosts($page: Int!, $limit: Int!) {
            blogDeletedPosts(page: $page, limit: $limit) { total }
          }
        `,
        variables: { page: 1, limit: 10 },
        token: adminToken,
      }).expect(200);

      expect(
        (finalDeletedRes.body as { data: { blogDeletedPosts: { total: number } } }).data
          .blogDeletedPosts.total,
      ).toBe(0);
    });
  });

  // ─── 错误路径 ───

  describe('错误路径', () => {
    it('恢复不存在的文章应返回错误', async () => {
      const res = await postGql({
        app,
        query: `mutation RestoreBlogPost($id: Int!) { restoreBlogPost(id: $id) { id } }`,
        variables: { id: 99999 },
        token: adminToken,
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
    });

    it('永久删除不存在的文章应返回错误', async () => {
      const res = await postGql({
        app,
        query: `mutation PermanentDeleteBlogPost($id: Int!) { permanentDeleteBlogPost(id: $id) }`,
        variables: { id: 99999 },
        token: adminToken,
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
    });

    it('未认证用户不能查看回收站', async () => {
      const res = await postGql({
        app,
        query: `
          query BlogDeletedPosts($page: Int!, $limit: Int!) {
            blogDeletedPosts(page: $page, limit: $limit) { total }
          }
        `,
        variables: { page: 1, limit: 10 },
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('UNAUTHENTICATED');
    });

    it('未认证用户不能恢复文章', async () => {
      const res = await postGql({
        app,
        query: `mutation RestoreBlogPost($id: Int!) { restoreBlogPost(id: $id) { id } }`,
        variables: { id: 1 },
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('UNAUTHENTICATED');
    });

    it('未认证用户不能永久删除文章', async () => {
      const res = await postGql({
        app,
        query: `mutation PermanentDeleteBlogPost($id: Int!) { permanentDeleteBlogPost(id: $id) }`,
        variables: { id: 1 },
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('UNAUTHENTICATED');
    });
  });
});
