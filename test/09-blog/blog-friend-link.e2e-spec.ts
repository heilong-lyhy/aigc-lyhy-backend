// test/09-blog/blog-friend-link.e2e-spec.ts
// 博客友情链接 e2e 测试：覆盖 CRUD + 公开/管理端查询

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { useContainer } from 'class-validator';
import { DataSource } from 'typeorm';
import { ApiModule } from '../../src/bootstraps/api/api.module';
import { initGraphQLSchema } from '../../src/adapters/api/graphql/schema/schema.init';
import { login, postGql } from '../utils/e2e-graphql-utils';
import { cleanupTestAccounts, seedTestAccounts, testAccountsConfig } from '../utils/test-accounts';

describe('Blog Friend Link (e2e)', () => {
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
      'blog_friend_link',
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

  // ─── 友链 CRUD ───

  describe('友链 CRUD', () => {
    it('应创建友链', async () => {
      const res = await postGql({
        app,
        query: `
          mutation CreateBlogFriendLink($input: CreateBlogFriendLinkInput!) {
            createBlogFriendLink(input: $input) { id name url isActive }
          }
        `,
        variables: {
          input: { name: '测试友链', url: 'https://example.com' },
        },
        token: adminToken,
      }).expect(200);

      const body = res.body as {
        data: {
          createBlogFriendLink: { id: number; name: string; url: string; isActive: boolean };
        };
      };
      expect(body.data.createBlogFriendLink.name).toBe('测试友链');
      expect(body.data.createBlogFriendLink.url).toBe('https://example.com');
      expect(body.data.createBlogFriendLink.isActive).toBe(true);
    });

    it('应更新友链', async () => {
      // 创建
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogFriendLink($input: CreateBlogFriendLinkInput!) {
            createBlogFriendLink(input: $input) { id }
          }
        `,
        variables: { input: { name: '旧名称', url: 'https://old.com' } },
        token: adminToken,
      }).expect(200);

      const id = Number(
        (createRes.body as { data: { createBlogFriendLink: { id: number } } }).data
          .createBlogFriendLink.id,
      );

      // 更新
      const updateRes = await postGql({
        app,
        query: `
          mutation UpdateBlogFriendLink($input: UpdateBlogFriendLinkInput!) {
            updateBlogFriendLink(input: $input) { id name isActive }
          }
        `,
        variables: { input: { id, name: '新名称', isActive: false } },
        token: adminToken,
      }).expect(200);

      const body = updateRes.body as {
        data: { updateBlogFriendLink: { id: number; name: string; isActive: boolean } };
      };
      expect(body.data.updateBlogFriendLink.name).toBe('新名称');
      expect(body.data.updateBlogFriendLink.isActive).toBe(false);
    });

    it('应删除友链', async () => {
      // 创建
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogFriendLink($input: CreateBlogFriendLinkInput!) {
            createBlogFriendLink(input: $input) { id }
          }
        `,
        variables: { input: { name: '待删除', url: 'https://del.com' } },
        token: adminToken,
      }).expect(200);

      const id = Number(
        (createRes.body as { data: { createBlogFriendLink: { id: number } } }).data
          .createBlogFriendLink.id,
      );

      // 删除
      const deleteRes = await postGql({
        app,
        query: `mutation DeleteBlogFriendLink($id: Int!) { deleteBlogFriendLink(id: $id) }`,
        variables: { id },
        token: adminToken,
      }).expect(200);

      expect(
        (deleteRes.body as { data: { deleteBlogFriendLink: boolean } }).data.deleteBlogFriendLink,
      ).toBe(true);
    });
  });

  // ─── 公开 vs 管理端查询 ───

  describe('公开 vs 管理端查询', () => {
    it('公开查询应只返回启用的友链', async () => {
      // 创建启用和禁用的友链
      await postGql({
        app,
        query: `
          mutation CreateBlogFriendLink($input: CreateBlogFriendLinkInput!) {
            createBlogFriendLink(input: $input) { id }
          }
        `,
        variables: { input: { name: '启用友链', url: 'https://active.com', isActive: true } },
        token: adminToken,
      }).expect(200);

      const createDisabledRes = await postGql({
        app,
        query: `
          mutation CreateBlogFriendLink($input: CreateBlogFriendLinkInput!) {
            createBlogFriendLink(input: $input) { id }
          }
        `,
        variables: { input: { name: '禁用友链', url: 'https://inactive.com', isActive: false } },
        token: adminToken,
      }).expect(200);

      const disabledId = Number(
        (createDisabledRes.body as { data: { createBlogFriendLink: { id: number } } }).data
          .createBlogFriendLink.id,
      );

      // 更新为禁用
      await postGql({
        app,
        query: `
          mutation UpdateBlogFriendLink($input: UpdateBlogFriendLinkInput!) {
            updateBlogFriendLink(input: $input) { id }
          }
        `,
        variables: { input: { id: disabledId, isActive: false } },
        token: adminToken,
      }).expect(200);

      // 公开查询
      const publicRes = await postGql({
        app,
        query: `query { blogFriendLinks { name isActive } }`,
      }).expect(200);

      const publicLinks = (
        publicRes.body as {
          data: { blogFriendLinks: Array<{ name: string; isActive: boolean }> };
        }
      ).data.blogFriendLinks;
      expect(publicLinks.every((l) => l.isActive)).toBe(true);

      // 管理端查询
      const adminRes = await postGql({
        app,
        query: `query { blogAllFriendLinks { name isActive } }`,
        token: adminToken,
      }).expect(200);

      const adminLinks = (
        adminRes.body as {
          data: { blogAllFriendLinks: Array<{ name: string; isActive: boolean }> };
        }
      ).data.blogAllFriendLinks;
      expect(adminLinks.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── 错误路径 ───

  describe('错误路径', () => {
    it('未认证用户不能创建友链', async () => {
      const res = await postGql({
        app,
        query: `
          mutation CreateBlogFriendLink($input: CreateBlogFriendLinkInput!) {
            createBlogFriendLink(input: $input) { id }
          }
        `,
        variables: { input: { name: '未认证', url: 'https://unauth.com' } },
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('UNAUTHENTICATED');
    });

    it('更新不存在的友链应返回错误', async () => {
      const res = await postGql({
        app,
        query: `
          mutation UpdateBlogFriendLink($input: UpdateBlogFriendLinkInput!) {
            updateBlogFriendLink(input: $input) { id }
          }
        `,
        variables: { input: { id: 99999, name: '不存在' } },
        token: adminToken,
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
    });

    it('删除不存在的友链应返回错误', async () => {
      const res = await postGql({
        app,
        query: `mutation DeleteBlogFriendLink($id: Int!) { deleteBlogFriendLink(id: $id) }`,
        variables: { id: 99999 },
        token: adminToken,
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
    });
  });
});
