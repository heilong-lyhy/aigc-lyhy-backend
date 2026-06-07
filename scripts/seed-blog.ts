// scripts/seed-blog.ts
// 博客种子数据脚本：创建管理员账号、示例文章、分类、标签、评论
// 独立于业务代码，仅用于联调和开发环境初始化
//
// 使用方式：npx ts-node -r tsconfig-paths/register scripts/seed-blog.ts

import 'reflect-metadata';
import 'tsconfig-paths/register';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { BlogPostStatus, BlogCommentStatus } from '@app-types/models/blog.types';
import { BlogCategoryEntity } from '@src/modules/blog/entities/blog-category.entity';
import { BlogTagEntity } from '@src/modules/blog/entities/blog-tag.entity';
import { BlogPostEntity } from '@src/modules/blog/entities/blog-post.entity';
import { BlogCommentEntity } from '@src/modules/blog/entities/blog-comment.entity';
import { BlogProfileEntity } from '@src/modules/blog/entities/blog-profile.entity';
import { BlogLikeEntity } from '@src/modules/blog/entities/blog-like.entity';
import { BlogPostTagEntity } from '@src/modules/blog/entities/blog-post-tag.entity';
import databaseConfig from '@src/infrastructure/config/database.config';

// 加载环境变量
const envPath = path.resolve(__dirname, '../env/.env.development');
dotenv.config({ path: envPath });

async function seed() {
  const dbConfig = databaseConfig() as { mysql: Record<string, unknown> };
  const dataSource = new DataSource({
    ...dbConfig.mysql,
    entities: [
      BlogCategoryEntity,
      BlogTagEntity,
      BlogPostEntity,
      BlogPostTagEntity,
      BlogCommentEntity,
      BlogLikeEntity,
      BlogProfileEntity,
    ],
    synchronize: false,
  } as Record<string, unknown>);

  await dataSource.initialize();
  console.log('数据库连接成功');

  try {
    // 清理现有博客数据（按外键依赖顺序）
    console.log('清理现有博客数据...');
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
    await dataSource.query('TRUNCATE TABLE `blog_like`');
    await dataSource.query('TRUNCATE TABLE `blog_comment`');
    await dataSource.query('TRUNCATE TABLE `blog_post_tag`');
    await dataSource.query('TRUNCATE TABLE `blog_post`');
    await dataSource.query('TRUNCATE TABLE `blog_tag`');
    await dataSource.query('TRUNCATE TABLE `blog_category`');
    await dataSource.query('TRUNCATE TABLE `blog_profile`');
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('清理完成');

    // ─── 1. 创建博主信息 ───
    const profileRepo = dataSource.getRepository(BlogProfileEntity);
    const profile = profileRepo.create({
      nickname: '博主',
      bio: '全栈开发者，热爱技术与写作',
      avatarUrl: 'https://example.com/avatar.png',
      socialLinks: { github: 'https://github.com/example', twitter: 'https://twitter.com/example' },
    });
    await profileRepo.save(profile);
    console.log(`博主信息已创建: ${profile.nickname}`);

    // ─── 2. 创建分类（含层级） ───
    const categoryRepo = dataSource.getRepository(BlogCategoryEntity);

    const techCategory = categoryRepo.create({
      name: '技术',
      slug: 'tech',
      description: '技术相关文章',
      sortOrder: 1,
    });
    await categoryRepo.save(techCategory);

    const frontendCategory = categoryRepo.create({
      name: '前端',
      slug: 'frontend',
      description: '前端开发',
      parentId: techCategory.id,
      sortOrder: 1,
    });
    await categoryRepo.save(frontendCategory);

    const backendCategory = categoryRepo.create({
      name: '后端',
      slug: 'backend',
      description: '后端开发',
      parentId: techCategory.id,
      sortOrder: 2,
    });
    await categoryRepo.save(backendCategory);

    const lifeCategory = categoryRepo.create({
      name: '生活',
      slug: 'life',
      description: '生活随笔',
      sortOrder: 2,
    });
    await categoryRepo.save(lifeCategory);

    console.log(`分类已创建: ${[techCategory, frontendCategory, backendCategory, lifeCategory].map((c) => c.name).join(', ')}`);

    // ─── 3. 创建标签 ───
    const tagRepo = dataSource.getRepository(BlogTagEntity);
    const tagData = [
      { name: 'TypeScript', slug: 'typescript' },
      { name: 'NestJS', slug: 'nestjs' },
      { name: 'React', slug: 'react' },
      { name: 'GraphQL', slug: 'graphql' },
      { name: 'Node.js', slug: 'nodejs' },
      { name: 'Docker', slug: 'docker' },
    ];
    const tags = tagRepo.create(tagData);
    await tagRepo.save(tags);
    console.log(`标签已创建: ${tags.map((t) => t.name).join(', ')}`);

    // ─── 4. 创建文章 ───
    const postRepo = dataSource.getRepository(BlogPostEntity);
    const now = new Date();

    const posts = postRepo.create([
      {
        title: 'NestJS 分层架构实践',
        slug: 'nestjs-layered-architecture',
        excerpt: '探讨 NestJS 项目中分层架构的最佳实践',
        content: '# NestJS 分层架构实践\n\n本文探讨了在 NestJS 项目中如何实现清晰的分层架构...\n\n## 核心原则\n\n- adapters → usecases → modules\n- 依赖方向单向\n- 事务边界在 usecase',
        renderedContent: '<h1>NestJS 分层架构实践</h1><p>本文探讨了在 NestJS 项目中如何实现清晰的分层架构...</p>',
        status: BlogPostStatus.PUBLISHED,
        categoryId: backendCategory.id,
        viewCount: 128,
        likeCount: 15,
        commentCount: 3,
        isPinned: true,
        publishedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        title: 'React 18 新特性解析',
        slug: 'react-18-new-features',
        excerpt: '深入了解 React 18 带来的并发特性与自动批处理',
        content: '# React 18 新特性解析\n\nReact 18 引入了多项重要更新...\n\n## Concurrent Features\n\n- useTransition\n- useDeferredValue\n- Suspense 增强',
        renderedContent: '<h1>React 18 新特性解析</h1><p>React 18 引入了多项重要更新...</p>',
        status: BlogPostStatus.PUBLISHED,
        categoryId: frontendCategory.id,
        viewCount: 256,
        likeCount: 32,
        commentCount: 5,
        isPinned: false,
        publishedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        title: 'GraphQL 与 REST 的选择',
        slug: 'graphql-vs-rest',
        excerpt: '对比 GraphQL 和 REST 的适用场景',
        content: '# GraphQL 与 REST 的选择\n\n在实际项目中如何选择 API 风格...\n\n## GraphQL 优势\n\n- 按需获取\n- 强类型 Schema\n- 实时订阅',
        renderedContent: '<h1>GraphQL 与 REST 的选择</h1><p>在实际项目中如何选择 API 风格...</p>',
        status: BlogPostStatus.PUBLISHED,
        categoryId: techCategory.id,
        viewCount: 89,
        likeCount: 8,
        commentCount: 2,
        isPinned: false,
        publishedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        title: 'Docker 容器化部署指南（草稿）',
        slug: 'docker-deployment-guide',
        excerpt: 'Docker 容器化部署的完整指南',
        content: '# Docker 容器化部署指南\n\n这是一篇草稿文章...',
        status: BlogPostStatus.DRAFT,
        categoryId: backendCategory.id,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        isPinned: false,
        publishedAt: null,
      },
      {
        title: '周末徒步记',
        slug: 'weekend-hiking',
        excerpt: '记录一次周末山野徒步的经历',
        content: '# 周末徒步记\n\n上周末去了郊外徒步，风景很美...',
        status: BlogPostStatus.PUBLISHED,
        categoryId: lifeCategory.id,
        viewCount: 45,
        likeCount: 5,
        commentCount: 1,
        isPinned: false,
        publishedAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      },
    ]);
    await postRepo.save(posts);
    console.log(`文章已创建: ${posts.length} 篇`);

    // ─── 5. 关联标签与文章 ───
    const postTagRepo = dataSource.getRepository(BlogPostTagEntity);
    const postTagRelations = [
      { postId: posts[0].id, tagId: tags[1].id }, // NestJS 分层 → NestJS
      { postId: posts[0].id, tagId: tags[4].id }, // NestJS 分层 → Node.js
      { postId: posts[1].id, tagId: tags[0].id }, // React 18 → TypeScript
      { postId: posts[1].id, tagId: tags[2].id }, // React 18 → React
      { postId: posts[2].id, tagId: tags[3].id }, // GraphQL vs REST → GraphQL
      { postId: posts[3].id, tagId: tags[5].id }, // Docker → Docker
      { postId: posts[3].id, tagId: tags[4].id }, // Docker → Node.js
    ];
    const postTags = postTagRepo.create(postTagRelations);
    await postTagRepo.save(postTags);
    console.log(`文章-标签关联已创建: ${postTagRelations.length} 条`);

    // ─── 6. 创建评论 ───
    const commentRepo = dataSource.getRepository(BlogCommentEntity);
    const comments = commentRepo.create([
      {
        postId: posts[0].id,
        parentId: null,
        replyToId: null,
        authorName: '开发者A',
        authorEmail: 'dev-a@example.com',
        authorUrl: null,
        authorAvatar: null,
        content: '非常好的架构文章，受益匪浅！',
        status: BlogCommentStatus.APPROVED,
        nestingLevel: 0,
      },
      {
        postId: posts[0].id,
        parentId: null,
        replyToId: null,
        authorName: '架构师B',
        authorEmail: 'arch-b@example.com',
        authorUrl: null,
        authorAvatar: null,
        content: '请问事务边界放在 usecase 层有什么优势？',
        status: BlogCommentStatus.APPROVED,
        nestingLevel: 0,
      },
      {
        postId: posts[0].id,
        parentId: null,
        replyToId: null,
        authorName: '博主',
        authorEmail: 'blogger@example.com',
        authorUrl: null,
        authorAvatar: null,
        content: '回复架构师B：事务边界在 usecase 层可以更好地控制跨聚合写入的一致性。',
        status: BlogCommentStatus.APPROVED,
        nestingLevel: 1,
      },
      {
        postId: posts[1].id,
        parentId: null,
        replyToId: null,
        authorName: '前端新手',
        authorEmail: 'fe-newbie@example.com',
        authorUrl: null,
        authorAvatar: null,
        content: 'React 18 的并发特性太棒了！',
        status: BlogCommentStatus.APPROVED,
        nestingLevel: 0,
      },
      {
        postId: posts[1].id,
        parentId: null,
        replyToId: null,
        authorName: '全栈C',
        authorEmail: 'fullstack-c@example.com',
        authorUrl: null,
        authorAvatar: null,
        content: 'useTransition 的使用场景能再详细说说吗？',
        status: BlogCommentStatus.PENDING,
        nestingLevel: 0,
      },
      {
        postId: posts[2].id,
        parentId: null,
        replyToId: null,
        authorName: 'API 爱好者',
        authorEmail: 'api-lover@example.com',
        authorUrl: null,
        authorAvatar: null,
        content: '我们团队从 REST 迁移到 GraphQL 后效率提升明显',
        status: BlogCommentStatus.APPROVED,
        nestingLevel: 0,
      },
      {
        postId: posts[4].id,
        parentId: null,
        replyToId: null,
        authorName: '户外达人',
        authorEmail: 'outdoor@example.com',
        authorUrl: null,
        authorAvatar: null,
        content: '风景真不错，下次一起去！',
        status: BlogCommentStatus.APPROVED,
        nestingLevel: 0,
      },
    ]);
    await commentRepo.save(comments);

    // 设置回复关系（第3条评论回复第2条）
    await commentRepo.update(comments[2].id, { parentId: comments[1].id, replyToId: comments[1].id });
    console.log(`评论已创建: ${comments.length} 条`);

    // ─── 7. 创建点赞记录 ───
    const likeRepo = dataSource.getRepository(BlogLikeEntity);
    const likes = likeRepo.create([
      { postId: posts[0].id, userIdentifier: 'user:1' },
      { postId: posts[0].id, userIdentifier: 'user:2' },
      { postId: posts[1].id, userIdentifier: 'user:1' },
      { postId: posts[1].id, userIdentifier: 'user:3' },
      { postId: posts[2].id, userIdentifier: 'user:2' },
      { postId: posts[4].id, userIdentifier: 'user:1' },
    ]);
    await likeRepo.save(likes);
    console.log(`点赞记录已创建: ${likes.length} 条`);

    console.log('\n种子数据创建完成！');
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

seed().catch((error) => {
  console.error('种子数据创建失败:', error);
  process.exit(1);
});
