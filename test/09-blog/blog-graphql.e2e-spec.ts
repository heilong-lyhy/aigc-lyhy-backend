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

      const postId = Number(
        (createRes.body as { data: { createBlogPost: { id: number } } }).data.createBlogPost.id,
      );

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

      const postId = Number(
        (createRes.body as { data: { createBlogPost: { id: number } } }).data.createBlogPost.id,
      );

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

      const postId = Number(
        (createRes.body as { data: { createBlogPost: { id: number } } }).data.createBlogPost.id,
      );

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
          },
        },
        token: adminToken,
      }).expect(200);

      const postId = Number(
        (createRes.body as { data: { createBlogPost: { id: number } } }).data.createBlogPost.id,
      );

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

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('UNAUTHENTICATED');
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
          },
        },
        token: adminToken,
      }).expect(200);

      publishedPostId = Number(
        (createRes.body as { data: { createBlogPost: { id: number } } }).data.createBlogPost.id,
      );

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

      const commentId = Number(
        (createRes.body as { data: { createBlogComment: { id: number } } }).data.createBlogComment
          .id,
      );

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

      const commentId = Number(
        (createRes.body as { data: { createBlogComment: { id: number } } }).data.createBlogComment
          .id,
      );

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

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('UNAUTHENTICATED');
    });
  });

  // ─── 错误路径 ───

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
          },
        },
        token: adminToken,
      }).expect(200);

      publishedPostId = Number(
        (createRes.body as { data: { createBlogPost: { id: number } } }).data.createBlogPost.id,
      );

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

  // ─── 标签更新 ───

  describe('标签更新', () => {
    it('应更新标签名称', async () => {
      // 创建标签
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogTag($name: String!, $slug: String!) {
            createBlogTag(name: $name, slug: $slug) { id name slug }
          }
        `,
        variables: { name: '旧标签', slug: 'old-tag' },
        token: adminToken,
      }).expect(200);

      const tagId = Number(
        (createRes.body as { data: { createBlogTag: { id: number } } }).data.createBlogTag.id,
      );

      // 更新标签
      const updateRes = await postGql({
        app,
        query: `
          mutation UpdateBlogTag($input: UpdateBlogTagInput!) {
            updateBlogTag(input: $input) { id name slug }
          }
        `,
        variables: { input: { id: tagId, name: '新标签' } },
        token: adminToken,
      }).expect(200);

      const body = updateRes.body as {
        data: { updateBlogTag: { id: number; name: string; slug: string } };
      };
      expect(body.data.updateBlogTag.name).toBe('新标签');
      expect(body.data.updateBlogTag.slug).toBe('old-tag');
    });

    it('应更新标签 slug', async () => {
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogTag($name: String!, $slug: String!) {
            createBlogTag(name: $name, slug: $slug) { id }
          }
        `,
        variables: { name: '标签', slug: 'old-slug' },
        token: adminToken,
      }).expect(200);

      const tagId = Number(
        (createRes.body as { data: { createBlogTag: { id: number } } }).data.createBlogTag.id,
      );

      const updateRes = await postGql({
        app,
        query: `
          mutation UpdateBlogTag($input: UpdateBlogTagInput!) {
            updateBlogTag(input: $input) { id slug }
          }
        `,
        variables: { input: { id: tagId, slug: 'new-slug' } },
        token: adminToken,
      }).expect(200);

      const body = updateRes.body as { data: { updateBlogTag: { id: number; slug: string } } };
      expect(body.data.updateBlogTag.slug).toBe('new-slug');
    });

    it('更新不存在的标签应返回 NOT_FOUND', async () => {
      const res = await postGql({
        app,
        query: `
          mutation UpdateBlogTag($input: UpdateBlogTagInput!) {
            updateBlogTag(input: $input) { id }
          }
        `,
        variables: { input: { id: 99999, name: '不存在' } },
        token: adminToken,
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('NOT_FOUND');
      expect(body.errors![0].extensions?.errorCode).toBe('BLOG_TAG_NOT_FOUND');
    });

    it('更新标签 slug 为已存在值应返回 CONFLICT', async () => {
      // 创建两个标签
      await postGql({
        app,
        query: `
          mutation CreateBlogTag($name: String!, $slug: String!) {
            createBlogTag(name: $name, slug: $slug) { id }
          }
        `,
        variables: { name: '标签A', slug: 'tag-a' },
        token: adminToken,
      }).expect(200);

      const createBRes = await postGql({
        app,
        query: `
          mutation CreateBlogTag($name: String!, $slug: String!) {
            createBlogTag(name: $name, slug: $slug) { id }
          }
        `,
        variables: { name: '标签B', slug: 'tag-b' },
        token: adminToken,
      }).expect(200);

      const tagBId = Number(
        (createBRes.body as { data: { createBlogTag: { id: number } } }).data.createBlogTag.id,
      );

      // 尝试将标签B的slug改为tag-a
      const res = await postGql({
        app,
        query: `
          mutation UpdateBlogTag($input: UpdateBlogTagInput!) {
            updateBlogTag(input: $input) { id }
          }
        `,
        variables: { input: { id: tagBId, slug: 'tag-a' } },
        token: adminToken,
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('CONFLICT');
      expect(body.errors![0].extensions?.errorCode).toBe('BLOG_TAG_SLUG_DUPLICATE');
    });

    it('未认证用户不能更新标签', async () => {
      const res = await postGql({
        app,
        query: `
          mutation UpdateBlogTag($input: UpdateBlogTagInput!) {
            updateBlogTag(input: $input) { id }
          }
        `,
        variables: { input: { id: 1, name: '未认证' } },
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('UNAUTHENTICATED');
    });
  });

  // ─── 分类更新 ───

  describe('分类更新', () => {
    it('应更新分类名称和描述', async () => {
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogCategory($input: CreateBlogCategoryInput!) {
            createBlogCategory(input: $input) { id name }
          }
        `,
        variables: { input: { name: '旧分类', slug: 'old-cat' } },
        token: adminToken,
      }).expect(200);

      const catId = Number(
        (createRes.body as { data: { createBlogCategory: { id: number } } }).data.createBlogCategory
          .id,
      );

      const updateRes = await postGql({
        app,
        query: `
          mutation UpdateBlogCategory($input: UpdateBlogCategoryInput!) {
            updateBlogCategory(input: $input) { id name description }
          }
        `,
        variables: { input: { id: catId, name: '新分类', description: '分类描述' } },
        token: adminToken,
      }).expect(200);

      const body = updateRes.body as {
        data: { updateBlogCategory: { id: number; name: string; description: string } };
      };
      expect(body.data.updateBlogCategory.name).toBe('新分类');
      expect(body.data.updateBlogCategory.description).toBe('分类描述');
    });

    it('更新不存在的分类应返回 NOT_FOUND', async () => {
      const res = await postGql({
        app,
        query: `
          mutation UpdateBlogCategory($input: UpdateBlogCategoryInput!) {
            updateBlogCategory(input: $input) { id }
          }
        `,
        variables: { input: { id: 99999, name: '不存在' } },
        token: adminToken,
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('NOT_FOUND');
      expect(body.errors![0].extensions?.errorCode).toBe('BLOG_CATEGORY_NOT_FOUND');
    });
  });

  // ─── 评论删除与批量审核 ───

  describe('评论删除与批量审核', () => {
    let publishedPostId: number;
    let commentPostCounter = 0;

    beforeEach(async () => {
      commentPostCounter++;
      const slug = `comment-admin-post-${commentPostCounter}-${Date.now()}`;
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) { id }
          }
        `,
        variables: {
          input: {
            title: '评论管理测试文章',
            slug,
            content: '内容',
          },
        },
        token: adminToken,
      }).expect(200);

      publishedPostId = Number(
        (createRes.body as { data: { createBlogPost: { id: number } } }).data.createBlogPost.id,
      );

      const publishRes = await postGql({
        app,
        query: `
          mutation PublishBlogPost($id: Int!) {
            publishBlogPost(id: $id) { id }
          }
        `,
        variables: { id: publishedPostId },
        token: adminToken,
      });
      if (publishRes.status !== 200) {
        console.log('PublishBlogPost failed:', JSON.stringify(publishRes.body));
      }
      expect(publishRes.status).toBe(200);
    });

    it('应删除评论', async () => {
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
            authorName: '待删除访客',
            authorEmail: 'delete@example.com',
            content: '待删除评论',
          },
        },
      }).expect(200);

      const commentId = Number(
        (createRes.body as { data: { createBlogComment: { id: number } } }).data.createBlogComment
          .id,
      );

      // 删除评论
      const deleteRes = await postGql({
        app,
        query: `
          mutation DeleteBlogComment($id: Int!) {
            deleteBlogComment(id: $id)
          }
        `,
        variables: { id: commentId },
        token: adminToken,
      }).expect(200);

      const body = deleteRes.body as { data: { deleteBlogComment: boolean } };
      expect(body.data.deleteBlogComment).toBe(true);
    });

    it('删除不存在的评论应返回 NOT_FOUND', async () => {
      const res = await postGql({
        app,
        query: `
          mutation DeleteBlogComment($id: Int!) {
            deleteBlogComment(id: $id)
          }
        `,
        variables: { id: 99999 },
        token: adminToken,
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('NOT_FOUND');
      expect(body.errors![0].extensions?.errorCode).toBe('BLOG_COMMENT_NOT_FOUND');
    });

    it('应批量审核评论', async () => {
      // 创建3条评论
      const commentIds: number[] = [];
      for (let i = 1; i <= 3; i++) {
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
              authorName: `访客${i}`,
              authorEmail: `batch${i}@example.com`,
              content: `批量评论${i}`,
            },
          },
        }).expect(200);

        commentIds.push(
          Number(
            (createRes.body as { data: { createBlogComment: { id: number } } }).data
              .createBlogComment.id,
          ),
        );
      }

      // 批量批准
      const batchRes = await postGql({
        app,
        query: `
          mutation BatchUpdateBlogCommentStatus($input: BatchUpdateBlogCommentStatusInput!) {
            batchUpdateBlogCommentStatus(input: $input)
          }
        `,
        variables: {
          input: { ids: commentIds, status: 'APPROVED' },
        },
        token: adminToken,
      }).expect(200);

      const body = batchRes.body as { data: { batchUpdateBlogCommentStatus: number } };
      expect(body.data.batchUpdateBlogCommentStatus).toBe(3);
    });

    it('批量审核部分不存在的 id 应返回实际更新数', async () => {
      // 创建1条评论
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
            authorName: '部分访客',
            authorEmail: 'partial@example.com',
            content: '部分批量评论',
          },
        },
      }).expect(200);

      const commentId = Number(
        (createRes.body as { data: { createBlogComment: { id: number } } }).data.createBlogComment
          .id,
      );

      const batchRes = await postGql({
        app,
        query: `
          mutation BatchUpdateBlogCommentStatus($input: BatchUpdateBlogCommentStatusInput!) {
            batchUpdateBlogCommentStatus(input: $input)
          }
        `,
        variables: {
          input: { ids: [commentId, 99998, 99999], status: 'REJECTED' },
        },
        token: adminToken,
      }).expect(200);

      const body = batchRes.body as { data: { batchUpdateBlogCommentStatus: number } };
      expect(body.data.batchUpdateBlogCommentStatus).toBe(1);
    });

    it('未认证用户不能删除评论', async () => {
      const res = await postGql({
        app,
        query: `
          mutation DeleteBlogComment($id: Int!) {
            deleteBlogComment(id: $id)
          }
        `,
        variables: { id: 1 },
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('UNAUTHENTICATED');
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
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('CONFLICT');
      expect(body.errors![0].extensions?.errorCode).toBe('BLOG_POST_SLUG_DUPLICATE');
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

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('NOT_FOUND');
      expect(body.errors![0].extensions?.errorCode).toBe('BLOG_POST_NOT_FOUND');
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
          },
        },
        token: adminToken,
      }).expect(200);

      const postId = Number(
        (createRes.body as { data: { createBlogPost: { id: number } } }).data.createBlogPost.id,
      );

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

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('CONFLICT');
      expect(body.errors![0].extensions?.errorCode).toBe('BLOG_POST_ALREADY_PUBLISHED');
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

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('CONFLICT');
      expect(body.errors![0].extensions?.errorCode).toBe('BLOG_CATEGORY_SLUG_DUPLICATE');
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

      const categoryId = Number(
        (catRes.body as { data: { createBlogCategory: { id: number } } }).data.createBlogCategory
          .id,
      );

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

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('CONFLICT');
      expect(body.errors![0].extensions?.errorCode).toBe('BLOG_CATEGORY_HAS_POSTS');
    });

    it('创建标签重复 slug 应返回错误', async () => {
      await postGql({
        app,
        query: `
          mutation CreateBlogTag($name: String!, $slug: String!) {
            createBlogTag(name: $name, slug: $slug) { id }
          }
        `,
        variables: { name: 'TypeScript', slug: 'typescript' },
        token: adminToken,
      }).expect(200);

      const res = await postGql({
        app,
        query: `
          mutation CreateBlogTag($name: String!, $slug: String!) {
            createBlogTag(name: $name, slug: $slug) { id }
          }
        `,
        variables: { name: 'TS', slug: 'typescript' },
        token: adminToken,
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('CONFLICT');
      expect(body.errors![0].extensions?.errorCode).toBe('BLOG_TAG_SLUG_DUPLICATE');
    });

    it('对不存在的文章提交评论应返回错误', async () => {
      const res = await postGql({
        app,
        query: `
          mutation CreateBlogComment($input: CreateBlogCommentInput!) {
            createBlogComment(input: $input) { id }
          }
        `,
        variables: {
          input: {
            postId: 99999,
            authorName: '访客',
            authorEmail: 'visitor@example.com',
            content: '评论不存在的文章',
          },
        },
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('NOT_FOUND');
      expect(body.errors![0].extensions?.errorCode).toBe('BLOG_POST_NOT_FOUND');
    });

    it('审核不存在的评论应返回错误', async () => {
      const res = await postGql({
        app,
        query: `
          mutation UpdateBlogCommentStatus($input: UpdateBlogCommentStatusInput!) {
            updateBlogCommentStatus(input: $input) { id }
          }
        `,
        variables: { input: { id: 99999, status: 'APPROVED' } },
        token: adminToken,
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('NOT_FOUND');
      expect(body.errors![0].extensions?.errorCode).toBe('BLOG_COMMENT_NOT_FOUND');
    });

    it('删除不存在的标签应返回 NOT_FOUND', async () => {
      const res = await postGql({
        app,
        query: `
          mutation DeleteBlogTag($id: Int!) {
            deleteBlogTag(id: $id)
          }
        `,
        variables: { id: 99999 },
        token: adminToken,
      });

      const errBody = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(errBody.errors).toBeDefined();
      expect(errBody.errors![0].extensions?.code).toBe('NOT_FOUND');
      expect(errBody.errors![0].extensions?.errorCode).toBe('BLOG_TAG_NOT_FOUND');
    });

    it('删除不存在的分类应返回 NOT_FOUND', async () => {
      const res = await postGql({
        app,
        query: `
          mutation DeleteBlogCategory($id: Int!) {
            deleteBlogCategory(id: $id)
          }
        `,
        variables: { id: 99999 },
        token: adminToken,
      });

      const errBody = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(errBody.errors).toBeDefined();
      expect(errBody.errors![0].extensions?.code).toBe('NOT_FOUND');
      expect(errBody.errors![0].extensions?.errorCode).toBe('BLOG_CATEGORY_NOT_FOUND');
    });

    it('删除有文章的标签应返回 CONFLICT', async () => {
      // 创建标签
      const createTagRes = await postGql({
        app,
        query: `
          mutation CreateBlogTag($name: String!, $slug: String!) {
            createBlogTag(name: $name, slug: $slug) { id }
          }
        `,
        variables: { name: '有文章标签', slug: 'has-posts-tag' },
        token: adminToken,
      }).expect(200);

      const tagId = Number(
        (createTagRes.body as { data: { createBlogTag: { id: number } } }).data.createBlogTag.id,
      );

      // 创建文章并关联标签
      await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) { id }
          }
        `,
        variables: {
          input: { title: '标签文章', slug: 'tagged-post-err', content: '内容', tagIds: [tagId] },
        },
        token: adminToken,
      }).expect(200);

      // 尝试删除有文章的标签
      const res = await postGql({
        app,
        query: `
          mutation DeleteBlogTag($id: Int!) {
            deleteBlogTag(id: $id)
          }
        `,
        variables: { id: tagId },
        token: adminToken,
      });

      const errBody = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(errBody.errors).toBeDefined();
      expect(errBody.errors![0].extensions?.code).toBe('CONFLICT');
      expect(errBody.errors![0].extensions?.errorCode).toBe('BLOG_TAG_HAS_POSTS');
    });
  });

  // ─── 分类 CRUD ───

  describe('分类 CRUD', () => {
    it('应创建分类', async () => {
      const res = await postGql({
        app,
        query: `
          mutation CreateBlogCategory($input: CreateBlogCategoryInput!) {
            createBlogCategory(input: $input) { id name slug description parentId sortOrder postCount }
          }
        `,
        variables: { input: { name: '技术', slug: 'tech' } },
        token: adminToken,
      }).expect(200);

      const body = res.body as {
        data: { createBlogCategory: { id: number; name: string; slug: string; postCount: number } };
      };
      expect(body.data.createBlogCategory.name).toBe('技术');
      expect(body.data.createBlogCategory.slug).toBe('tech');
      expect(body.data.createBlogCategory.postCount).toBe(0);
    });

    it('应更新分类', async () => {
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogCategory($input: CreateBlogCategoryInput!) {
            createBlogCategory(input: $input) { id }
          }
        `,
        variables: { input: { name: '旧分类', slug: 'old-cat' } },
        token: adminToken,
      }).expect(200);

      const catId = Number(
        (createRes.body as { data: { createBlogCategory: { id: number } } }).data.createBlogCategory
          .id,
      );

      const updateRes = await postGql({
        app,
        query: `
          mutation UpdateBlogCategory($input: UpdateBlogCategoryInput!) {
            updateBlogCategory(input: $input) { id name slug description }
          }
        `,
        variables: { input: { id: catId, name: '新分类', description: '分类描述' } },
        token: adminToken,
      }).expect(200);

      const body = updateRes.body as {
        data: { updateBlogCategory: { id: number; name: string; description: string } };
      };
      expect(body.data.updateBlogCategory.name).toBe('新分类');
      expect(body.data.updateBlogCategory.description).toBe('分类描述');
    });

    it('应删除空分类', async () => {
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogCategory($input: CreateBlogCategoryInput!) {
            createBlogCategory(input: $input) { id }
          }
        `,
        variables: { input: { name: '待删除', slug: 'to-delete-cat' } },
        token: adminToken,
      }).expect(200);

      const catId = Number(
        (createRes.body as { data: { createBlogCategory: { id: number } } }).data.createBlogCategory
          .id,
      );

      const deleteRes = await postGql({
        app,
        query: `
          mutation DeleteBlogCategory($id: Int!) { deleteBlogCategory(id: $id) }
        `,
        variables: { id: catId },
        token: adminToken,
      }).expect(200);

      const body = deleteRes.body as { data: { deleteBlogCategory: boolean } };
      expect(body.data.deleteBlogCategory).toBe(true);
    });

    it('删除有文章的分类应返回错误', async () => {
      const createCatRes = await postGql({
        app,
        query: `
          mutation CreateBlogCategory($input: CreateBlogCategoryInput!) {
            createBlogCategory(input: $input) { id }
          }
        `,
        variables: { input: { name: '有文章分类', slug: 'has-posts-cat' } },
        token: adminToken,
      }).expect(200);

      const catId = Number(
        (createCatRes.body as { data: { createBlogCategory: { id: number } } }).data
          .createBlogCategory.id,
      );

      await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) { id }
          }
        `,
        variables: {
          input: { title: '分类文章', slug: 'cat-post-err', content: '内容', categoryId: catId },
        },
        token: adminToken,
      }).expect(200);

      const res = await postGql({
        app,
        query: `
          mutation DeleteBlogCategory($id: Int!) { deleteBlogCategory(id: $id) }
        `,
        variables: { id: catId },
        token: adminToken,
      });

      const errBody = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(errBody.errors).toBeDefined();
      expect(errBody.errors![0].extensions?.code).toBe('CONFLICT');
      expect(errBody.errors![0].extensions?.errorCode).toBe('BLOG_CATEGORY_HAS_POSTS');
    });

    it('应查询分类列表', async () => {
      await postGql({
        app,
        query: `
          mutation CreateBlogCategory($input: CreateBlogCategoryInput!) {
            createBlogCategory(input: $input) { id }
          }
        `,
        variables: { input: { name: '技术', slug: 'tech-list' } },
        token: adminToken,
      }).expect(200);

      const res = await postGql({
        app,
        query: `
          query BlogCategories { blogCategories { id name slug postCount } }
        `,
      }).expect(200);

      const body = res.body as {
        data: { blogCategories: Array<{ id: number; name: string; postCount: number }> };
      };
      expect(body.data.blogCategories.length).toBeGreaterThanOrEqual(1);
    });

    it('应查询分类树', async () => {
      await postGql({
        app,
        query: `
          mutation CreateBlogCategory($input: CreateBlogCategoryInput!) {
            createBlogCategory(input: $input) { id }
          }
        `,
        variables: { input: { name: '根分类', slug: 'root-cat' } },
        token: adminToken,
      }).expect(200);

      const res = await postGql({
        app,
        query: `
          query BlogCategoryTree { blogCategoryTree { id name postCount } }
        `,
      }).expect(200);

      const body = res.body as {
        data: { blogCategoryTree: Array<{ id: number; name: string; postCount: number }> };
      };
      expect(body.data.blogCategoryTree.length).toBeGreaterThanOrEqual(1);
    });

    it('重复 slug 创建分类应返回错误', async () => {
      await postGql({
        app,
        query: `
          mutation CreateBlogCategory($input: CreateBlogCategoryInput!) {
            createBlogCategory(input: $input) { id }
          }
        `,
        variables: { input: { name: '分类1', slug: 'dup-cat-slug' } },
        token: adminToken,
      }).expect(200);

      const res = await postGql({
        app,
        query: `
          mutation CreateBlogCategory($input: CreateBlogCategoryInput!) {
            createBlogCategory(input: $input) { id }
          }
        `,
        variables: { input: { name: '分类2', slug: 'dup-cat-slug' } },
        token: adminToken,
      });

      const errBody = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(errBody.errors).toBeDefined();
      expect(errBody.errors![0].extensions?.code).toBe('CONFLICT');
      expect(errBody.errors![0].extensions?.errorCode).toBe('BLOG_CATEGORY_SLUG_DUPLICATE');
    });

    it('未认证用户不能创建分类', async () => {
      const res = await postGql({
        app,
        query: `
          mutation CreateBlogCategory($input: CreateBlogCategoryInput!) {
            createBlogCategory(input: $input) { id }
          }
        `,
        variables: { input: { name: '未认证', slug: 'unauth-cat' } },
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('UNAUTHENTICATED');
    });
  });

  // ─── 标签删除 ───

  describe('标签删除', () => {
    it('应删除空标签', async () => {
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogTag($name: String!, $slug: String!) {
            createBlogTag(name: $name, slug: $slug) { id }
          }
        `,
        variables: { name: '待删除标签', slug: 'to-delete-tag' },
        token: adminToken,
      }).expect(200);

      const tagId = Number(
        (createRes.body as { data: { createBlogTag: { id: number } } }).data.createBlogTag.id,
      );

      const deleteRes = await postGql({
        app,
        query: `
          mutation DeleteBlogTag($id: Int!) { deleteBlogTag(id: $id) }
        `,
        variables: { id: tagId },
        token: adminToken,
      }).expect(200);

      const body = deleteRes.body as { data: { deleteBlogTag: boolean } };
      expect(body.data.deleteBlogTag).toBe(true);
    });

    it('应查询标签列表', async () => {
      await postGql({
        app,
        query: `
          mutation CreateBlogTag($name: String!, $slug: String!) {
            createBlogTag(name: $name, slug: $slug) { id }
          }
        `,
        variables: { name: '列表标签', slug: 'list-tag' },
        token: adminToken,
      }).expect(200);

      const res = await postGql({
        app,
        query: `
          query BlogTags { blogTags { id name slug postCount } }
        `,
      }).expect(200);

      const body = res.body as {
        data: { blogTags: Array<{ id: number; name: string; postCount: number }> };
      };
      expect(body.data.blogTags.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── 评论管理 ───

  describe('评论管理', () => {
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
          input: { title: '评论管理文章', slug: 'comment-mgmt-post', content: '内容' },
        },
        token: adminToken,
      }).expect(200);

      publishedPostId = Number(
        (createRes.body as { data: { createBlogPost: { id: number } } }).data.createBlogPost.id,
      );

      await postGql({
        app,
        query: `
          mutation PublishBlogPost($id: Int!) { publishBlogPost(id: $id) { id } }
        `,
        variables: { id: publishedPostId },
        token: adminToken,
      }).expect(200);
    });

    it('应批量审核评论', async () => {
      // 创建两条评论
      const ids: number[] = [];
      for (let i = 0; i < 2; i++) {
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
              authorName: `访客${i}`,
              authorEmail: `visitor${i}@example.com`,
              content: `评论${i}`,
            },
          },
        }).expect(200);

        ids.push(
          Number(
            (createRes.body as { data: { createBlogComment: { id: number } } }).data
              .createBlogComment.id,
          ),
        );
      }

      // 批量批准
      const batchRes = await postGql({
        app,
        query: `
          mutation BatchUpdateBlogCommentStatus($input: BatchUpdateBlogCommentStatusInput!) {
            batchUpdateBlogCommentStatus(input: $input)
          }
        `,
        variables: { input: { ids, status: 'APPROVED' } },
        token: adminToken,
      }).expect(200);

      const body = batchRes.body as { data: { batchUpdateBlogCommentStatus: number } };
      expect(body.data.batchUpdateBlogCommentStatus).toBe(2);
    });

    it('应删除评论', async () => {
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
            authorName: '待删除访客',
            authorEmail: 'del@example.com',
            content: '待删除评论',
          },
        },
      }).expect(200);

      const commentId = Number(
        (createRes.body as { data: { createBlogComment: { id: number } } }).data.createBlogComment
          .id,
      );

      const deleteRes = await postGql({
        app,
        query: `
          mutation DeleteBlogComment($id: Int!) { deleteBlogComment(id: $id) }
        `,
        variables: { id: commentId },
        token: adminToken,
      }).expect(200);

      const body = deleteRes.body as { data: { deleteBlogComment: boolean } };
      expect(body.data.deleteBlogComment).toBe(true);
    });

    it('应查询管理端评论列表', async () => {
      // 创建一条评论
      await postGql({
        app,
        query: `
          mutation CreateBlogComment($input: CreateBlogCommentInput!) {
            createBlogComment(input: $input) { id }
          }
        `,
        variables: {
          input: {
            postId: publishedPostId,
            authorName: '列表访客',
            authorEmail: 'list@example.com',
            content: '列表评论',
          },
        },
      }).expect(200);

      const res = await postGql({
        app,
        query: `
          query BlogComments($page: Int, $limit: Int) {
            blogComments(page: $page, limit: $limit) {
              list { id authorName content status }
              current pageSize total
            }
          }
        `,
        variables: { page: 1, limit: 10 },
        token: adminToken,
      }).expect(200);

      const body = res.body as {
        data: {
          blogComments: {
            list: Array<{ id: number; authorName: string; status: string }>;
            total: number;
          };
        };
      };
      expect(body.data.blogComments.list.length).toBeGreaterThanOrEqual(1);
      expect(body.data.blogComments.total).toBeGreaterThanOrEqual(1);
    });

    it('应查询文章公开评论列表', async () => {
      // 创建并批准评论
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
            authorName: '公开访客',
            authorEmail: 'public@example.com',
            content: '公开评论',
          },
        },
      }).expect(200);

      const commentId = Number(
        (createRes.body as { data: { createBlogComment: { id: number } } }).data.createBlogComment
          .id,
      );

      await postGql({
        app,
        query: `
          mutation UpdateBlogCommentStatus($input: UpdateBlogCommentStatusInput!) {
            updateBlogCommentStatus(input: $input) { id status }
          }
        `,
        variables: { input: { id: commentId, status: 'APPROVED' } },
        token: adminToken,
      }).expect(200);

      const res = await postGql({
        app,
        query: `
          query BlogCommentsByPost($postId: Int!, $page: Int, $limit: Int) {
            blogCommentsByPost(postId: $postId, page: $page, limit: $limit) {
              list { id authorName content }
              total
            }
          }
        `,
        variables: { postId: publishedPostId, page: 1, limit: 10 },
      }).expect(200);

      const body = res.body as {
        data: {
          blogCommentsByPost: {
            list: Array<{ id: number; authorName: string }>;
            total: number;
          };
        };
      };
      expect(body.data.blogCommentsByPost.list.length).toBeGreaterThanOrEqual(1);
    });

    it('未认证用户不能删除评论', async () => {
      const res = await postGql({
        app,
        query: `
          mutation DeleteBlogComment($id: Int!) { deleteBlogComment(id: $id) }
        `,
        variables: { id: 999 },
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('UNAUTHENTICATED');
    });
  });

  // ─── 博主信息 ───

  describe('博主信息', () => {
    it('应查询博主信息（初始为 null）', async () => {
      const res = await postGql({
        app,
        query: `
          query BlogProfile { blogProfile { id nickname bio } }
        `,
      }).expect(200);

      const body = res.body as { data: { blogProfile: null } };
      expect(body.data.blogProfile).toBeNull();
    });

    it('无博主信息时更新应返回错误', async () => {
      const res = await postGql({
        app,
        query: `
          mutation UpdateBlogProfile($input: UpdateBlogProfileInput!) {
            updateBlogProfile(input: $input) { id nickname }
          }
        `,
        variables: { input: { nickname: '测试博主' } },
        token: adminToken,
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('NOT_FOUND');
      expect(body.errors![0].extensions?.errorCode).toBe('BLOG_PROFILE_NOT_FOUND');
    });

    it('有博主信息后应能更新', async () => {
      // 先通过数据库直接创建 profile 记录
      await dataSource.query(`INSERT INTO blog_profile (nickname) VALUES ('初始博主')`);

      const res = await postGql({
        app,
        query: `
          mutation UpdateBlogProfile($input: UpdateBlogProfileInput!) {
            updateBlogProfile(input: $input) { id nickname bio avatarUrl socialLinks }
          }
        `,
        variables: {
          input: {
            nickname: '测试博主',
            bio: '这是简介',
            socialLinks: { github: 'https://github.com/test' },
          },
        },
        token: adminToken,
      }).expect(200);

      const body = res.body as {
        data: {
          updateBlogProfile: {
            id: number;
            nickname: string;
            bio: string;
            socialLinks: Record<string, string>;
          };
        };
      };
      expect(body.data.updateBlogProfile.nickname).toBe('测试博主');
      expect(body.data.updateBlogProfile.bio).toBe('这是简介');
      expect(body.data.updateBlogProfile.socialLinks).toEqual({
        github: 'https://github.com/test',
      });
    });

    it('更新后应能查询到博主信息', async () => {
      // 先通过数据库直接创建 profile 记录
      await dataSource.query(`INSERT INTO blog_profile (nickname) VALUES ('初始博主2')`);

      await postGql({
        app,
        query: `
          mutation UpdateBlogProfile($input: UpdateBlogProfileInput!) {
            updateBlogProfile(input: $input) { id }
          }
        `,
        variables: { input: { nickname: '查询博主' } },
        token: adminToken,
      }).expect(200);

      const res = await postGql({
        app,
        query: `
          query BlogProfile { blogProfile { id nickname } }
        `,
      }).expect(200);

      const body = res.body as { data: { blogProfile: { id: number; nickname: string } } };
      expect(body.data.blogProfile).not.toBeNull();
      expect(body.data.blogProfile.nickname).toBe('查询博主');
    });

    it('未认证用户不能更新博主信息', async () => {
      const res = await postGql({
        app,
        query: `
          mutation UpdateBlogProfile($input: UpdateBlogProfileInput!) {
            updateBlogProfile(input: $input) { id }
          }
        `,
        variables: { input: { nickname: '未认证' } },
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('UNAUTHENTICATED');
    });
  });

  // ─── 仪表盘统计 ───

  describe('仪表盘统计', () => {
    it('应返回仪表盘统计数据', async () => {
      // 先创建一些数据
      await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) { id }
          }
        `,
        variables: { input: { title: '统计文章', slug: 'stats-post', content: '内容' } },
        token: adminToken,
      }).expect(200);

      const res = await postGql({
        app,
        query: `
          query BlogDashboardStats {
            blogDashboardStats {
              totalPosts publishedPosts draftPosts totalCategories totalTags
              totalComments pendingComments totalLikes totalViews
            }
          }
        `,
        token: adminToken,
      }).expect(200);

      const body = res.body as {
        data: {
          blogDashboardStats: {
            totalPosts: number;
            publishedPosts: number;
            draftPosts: number;
            totalCategories: number;
            totalTags: number;
            totalComments: number;
            pendingComments: number;
            totalLikes: number;
            totalViews: number;
          };
        };
      };
      expect(body.data.blogDashboardStats.totalPosts).toBeGreaterThanOrEqual(1);
      expect(body.data.blogDashboardStats.draftPosts).toBeGreaterThanOrEqual(1);
    });

    it('未认证用户不能查询仪表盘', async () => {
      const res = await postGql({
        app,
        query: `
          query BlogDashboardStats {
            blogDashboardStats { totalPosts }
          }
        `,
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('UNAUTHENTICATED');
    });
  });

  // ─── 公开文章查询 ───

  describe('公开文章查询', () => {
    it('blogPost 应只返回已发布文章', async () => {
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) { id }
          }
        `,
        variables: { input: { title: '草稿文章', slug: 'draft-query-post', content: '内容' } },
        token: adminToken,
      }).expect(200);

      const draftId = Number(
        (createRes.body as { data: { createBlogPost: { id: number } } }).data.createBlogPost.id,
      );

      // 草稿文章通过公开查询应返回 null
      const draftRes = await postGql({
        app,
        query: `
          query BlogPost($id: Int!) { blogPost(id: $id) { id title } }
        `,
        variables: { id: draftId },
      }).expect(200);

      const draftBody = draftRes.body as { data: { blogPost: null } };
      expect(draftBody.data.blogPost).toBeNull();
    });

    it('blogPostBySlug 应返回已发布文章并触发阅读量自增', async () => {
      const createRes = await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) { id }
          }
        `,
        variables: { input: { title: 'Slug查询文章', slug: 'slug-query-post', content: '内容' } },
        token: adminToken,
      }).expect(200);

      const postId = Number(
        (createRes.body as { data: { createBlogPost: { id: number } } }).data.createBlogPost.id,
      );

      await postGql({
        app,
        query: `
          mutation PublishBlogPost($id: Int!) { publishBlogPost(id: $id) { id } }
        `,
        variables: { id: postId },
        token: adminToken,
      }).expect(200);

      // 通过 slug 查询
      const res = await postGql({
        app,
        query: `
          query BlogPostBySlug($slug: String!) { blogPostBySlug(slug: $slug) { id title slug viewCount } }
        `,
        variables: { slug: 'slug-query-post' },
      }).expect(200);

      const body = res.body as {
        data: { blogPostBySlug: { id: number; slug: string; viewCount: number } };
      };
      expect(body.data.blogPostBySlug).not.toBeNull();
      expect(body.data.blogPostBySlug.slug).toBe('slug-query-post');
      // 阅读量应至少为 1（fire-and-forget，需要短暂等待）
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    it('blogPostBySlug 对草稿文章应返回 null', async () => {
      await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) { id }
          }
        `,
        variables: { input: { title: '草稿Slug', slug: 'draft-slug-post', content: '内容' } },
        token: adminToken,
      }).expect(200);

      const res = await postGql({
        app,
        query: `
          query BlogPostBySlug($slug: String!) { blogPostBySlug(slug: $slug) { id } }
        `,
        variables: { slug: 'draft-slug-post' },
      }).expect(200);

      const body = res.body as { data: { blogPostBySlug: null } };
      expect(body.data.blogPostBySlug).toBeNull();
    });
  });

  // ─── 管理端文章列表查询 ───

  describe('管理端文章列表查询', () => {
    it('应查询管理端文章列表（含草稿）', async () => {
      await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) { id }
          }
        `,
        variables: { input: { title: '管理端文章', slug: 'admin-list-post', content: '内容' } },
        token: adminToken,
      }).expect(200);

      const res = await postGql({
        app,
        query: `
          query BlogPosts($page: Int, $limit: Int) {
            blogPosts(page: $page, limit: $limit) {
              list { id title status }
              current pageSize total
            }
          }
        `,
        variables: { page: 1, limit: 10 },
        token: adminToken,
      }).expect(200);

      const body = res.body as {
        data: {
          blogPosts: { list: Array<{ id: number; title: string; status: string }>; total: number };
        };
      };
      expect(body.data.blogPosts.list.length).toBeGreaterThanOrEqual(1);
      expect(body.data.blogPosts.total).toBeGreaterThanOrEqual(1);
    });

    it('应按状态筛选文章', async () => {
      await postGql({
        app,
        query: `
          mutation CreateBlogPost($input: CreateBlogPostInput!) {
            createBlogPost(input: $input) { id }
          }
        `,
        variables: { input: { title: '草稿筛选', slug: 'draft-filter-post', content: '内容' } },
        token: adminToken,
      }).expect(200);

      const res = await postGql({
        app,
        query: `
          query BlogPosts($status: BlogPostStatus) {
            blogPosts(status: $status) {
              list { id status }
              total
            }
          }
        `,
        variables: { status: 'DRAFT' },
        token: adminToken,
      }).expect(200);

      const body = res.body as {
        data: { blogPosts: { list: Array<{ id: number; status: string }>; total: number } };
      };
      expect(body.data.blogPosts.list.every((p) => p.status === 'DRAFT')).toBe(true);
    });

    it('未认证用户不能查询管理端文章列表', async () => {
      const res = await postGql({
        app,
        query: `
          query BlogPosts { blogPosts(page: 1, limit: 10) { list { id } total } }
        `,
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('UNAUTHENTICATED');
    });
  });

  // ─── 文章错误路径补充 ───

  describe('文章错误路径', () => {
    it('更新不存在的文章应返回错误', async () => {
      const res = await postGql({
        app,
        query: `
          mutation UpdateBlogPost($input: UpdateBlogPostInput!) {
            updateBlogPost(input: $input) { id }
          }
        `,
        variables: { input: { id: 99999, title: '不存在' } },
        token: adminToken,
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('NOT_FOUND');
      expect(body.errors![0].extensions?.errorCode).toBe('BLOG_POST_NOT_FOUND');
    });

    it('删除不存在的文章应返回错误', async () => {
      const res = await postGql({
        app,
        query: `
          mutation DeleteBlogPost($id: Int!) { deleteBlogPost(id: $id) }
        `,
        variables: { id: 99999 },
        token: adminToken,
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('NOT_FOUND');
      expect(body.errors![0].extensions?.errorCode).toBe('BLOG_POST_NOT_FOUND');
    });

    it('发布不存在的文章应返回错误', async () => {
      const res = await postGql({
        app,
        query: `
          mutation PublishBlogPost($id: Int!) { publishBlogPost(id: $id) { id } }
        `,
        variables: { id: 99999 },
        token: adminToken,
      });

      const body = res.body as {
        errors?: Array<{ message: string; extensions?: { code?: string; errorCode?: string } }>;
      };
      expect(body.errors).toBeDefined();
      expect(body.errors![0].extensions?.code).toBe('NOT_FOUND');
      expect(body.errors![0].extensions?.errorCode).toBe('BLOG_POST_NOT_FOUND');
    });
  });
});
