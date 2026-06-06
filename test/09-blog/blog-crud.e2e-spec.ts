// test/09-blog/blog-crud.e2e-spec.ts
// 博客模块 CRUD 集成测试：通过 NestJS 测试模块 + 真实数据库验证服务层

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { useContainer } from 'class-validator';
import { DataSource } from 'typeorm';
import { ApiModule } from '../../src/bootstraps/api/api.module';
import { BlogPostService } from '../../src/modules/blog/blog-post.service';
import { BlogCategoryService } from '../../src/modules/blog/blog-category.service';
import { BlogTagService } from '../../src/modules/blog/blog-tag.service';
import { BlogCommentService } from '../../src/modules/blog/blog-comment.service';
import { BlogLikeService } from '../../src/modules/blog/blog-like.service';
import { BlogProfileService } from '../../src/modules/blog/blog-profile.service';
import { BlogFileService } from '../../src/modules/blog/blog-file.service';
import { BlogPostQueryService } from '../../src/modules/blog/queries/blog-post.query.service';
import { BlogCategoryQueryService } from '../../src/modules/blog/queries/blog-category.query.service';
import { BlogTagQueryService } from '../../src/modules/blog/queries/blog-tag.query.service';
import { BlogProfileQueryService } from '../../src/modules/blog/queries/blog-profile.query.service';
import { BlogPostStatus, BlogCommentStatus, BlogFileType } from '../../src/modules/blog/blog.types';
import { BlogCommentEntity } from '../../src/modules/blog/entities/blog-comment.entity';
import { DomainError } from '../../src/core/common/errors/domain-error';
import { initGraphQLSchema } from '../../src/adapters/api/graphql/schema/schema.init';

describe('Blog CRUD (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let postService: BlogPostService;
  let categoryService: BlogCategoryService;
  let tagService: BlogTagService;
  let commentService: BlogCommentService;
  let likeService: BlogLikeService;
  let profileService: BlogProfileService;
  let fileService: BlogFileService;
  let postQueryService: BlogPostQueryService;
  let categoryQueryService: BlogCategoryQueryService;
  let tagQueryService: BlogTagQueryService;
  let profileQueryService: BlogProfileQueryService;

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
    likeService = moduleFixture.get<BlogLikeService>(BlogLikeService);
    profileService = moduleFixture.get<BlogProfileService>(BlogProfileService);
    fileService = moduleFixture.get<BlogFileService>(BlogFileService);
    postQueryService = moduleFixture.get<BlogPostQueryService>(BlogPostQueryService);
    categoryQueryService = moduleFixture.get<BlogCategoryQueryService>(BlogCategoryQueryService);
    tagQueryService = moduleFixture.get<BlogTagQueryService>(BlogTagQueryService);
    profileQueryService = moduleFixture.get<BlogProfileQueryService>(BlogProfileQueryService);

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

  // ─── Category CRUD ───

  describe('Category CRUD', () => {
    it('应创建分类并查询到 postCount=0', async () => {
      const created = await categoryService.createCategory({
        name: '技术',
        slug: 'tech',
      });

      expect(created.name).toBe('技术');
      expect(created).not.toHaveProperty('postCount');

      const view = await categoryQueryService.findCategoryById(created.id);
      expect(view).not.toBeNull();
      expect(view!.postCount).toBe(0);
    });

    it('应更新分类名称', async () => {
      const created = await categoryService.createCategory({ name: '旧名称', slug: 'old' });
      const updated = await categoryService.updateCategory(created.id, { name: '新名称' });

      expect(updated.name).toBe('新名称');
    });

    it('应软删除分类', async () => {
      const created = await categoryService.createCategory({ name: '待删除', slug: 'del' });
      await categoryService.softDeleteCategory(created.id);

      const view = await categoryQueryService.findCategoryById(created.id);
      expect(view).toBeNull();
    });

    it('应构建分类树', async () => {
      const root = await categoryService.createCategory({ name: '根', slug: 'root' });
      const child = await categoryService.createCategory({
        name: '子',
        slug: 'child',
        parentId: root.id,
      });

      const tree = await categoryQueryService.getCategoryTree();

      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe(root.id);
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].id).toBe(child.id);
    });
  });

  // ─── Tag CRUD ───

  describe('Tag CRUD', () => {
    it('应创建标签并查询到 postCount=0', async () => {
      const created = await tagService.createTag({ name: 'TypeScript', slug: 'typescript' });

      expect(created.name).toBe('TypeScript');

      const view = await tagQueryService.findTagById(created.id);
      expect(view).not.toBeNull();
      expect(view!.postCount).toBe(0);
    });

    it('应软删除标签', async () => {
      const created = await tagService.createTag({ name: '删除', slug: 'del' });
      await tagService.softDeleteTag(created.id);

      const view = await tagQueryService.findTagById(created.id);
      expect(view).toBeNull();
    });
  });

  // ─── Post CRUD ───

  describe('Post CRUD', () => {
    it('应创建文章并查询详情', async () => {
      const category = await categoryService.createCategory({ name: '技术', slug: 'tech' });

      const created = await postService.createPost({
        title: '测试文章',
        slug: 'test-post',
        content: '文章内容',
        categoryId: category.id,
        status: BlogPostStatus.PUBLISHED,
      });

      expect(created.title).toBe('测试文章');
      expect(created.categoryId).toBe(category.id);

      const detail = await postQueryService.findPostById(created.id);
      expect(detail).not.toBeNull();
      expect(detail!.categoryName).toBe('技术');
    });

    it('应更新文章标题和状态', async () => {
      const created = await postService.createPost({
        title: '旧标题',
        slug: 'old-slug',
        content: '内容',
      });

      const updated = await postService.updatePost(created.id, {
        title: '新标题',
        status: BlogPostStatus.PUBLISHED,
      });

      expect(updated.title).toBe('新标题');
      expect(updated.status).toBe(BlogPostStatus.PUBLISHED);
    });

    it('应软删除文章', async () => {
      const created = await postService.createPost({
        title: '待删除',
        slug: 'to-delete',
        content: '内容',
      });

      await postService.softDeletePost(created.id);

      const detail = await postQueryService.findPostById(created.id);
      expect(detail).toBeNull();
    });

    it('应通过 slug 查询文章', async () => {
      await postService.createPost({
        title: 'Slug测试',
        slug: 'unique-slug',
        content: '内容',
      });

      const detail = await postQueryService.findPostBySlug('unique-slug');
      expect(detail).not.toBeNull();
      expect(detail!.slug).toBe('unique-slug');
    });

    it('应递增浏览量', async () => {
      const created = await postService.createPost({
        title: '浏览量测试',
        slug: 'view-count',
        content: '内容',
      });

      await postService.incrementViewCount(created.id);
      await postService.incrementViewCount(created.id);

      const detail = await postQueryService.findPostById(created.id);
      expect(detail!.viewCount).toBe(2);
    });
  });

  // ─── Comment CRUD ───

  describe('Comment CRUD', () => {
    it('应创建顶级评论和嵌套回复', async () => {
      const post = await postService.createPost({
        title: '评论测试',
        slug: 'comment-test',
        content: '内容',
      });

      const topComment = await commentService.createComment({
        postId: post.id,
        authorName: '访客1',
        authorEmail: 'visitor1@example.com',
        content: '顶级评论',
      });

      expect(topComment.nestingLevel).toBe(0);

      const reply = await commentService.createComment({
        postId: post.id,
        parentId: topComment.id,
        authorName: '访客2',
        authorEmail: 'visitor2@example.com',
        content: '回复评论',
      });

      expect(reply.nestingLevel).toBe(1);
      expect(reply.parentId).toBe(topComment.id);
    });

    it('应更新评论状态', async () => {
      const post = await postService.createPost({
        title: '审核测试',
        slug: 'review-test',
        content: '内容',
      });

      const comment = await commentService.createComment({
        postId: post.id,
        authorName: '访客',
        authorEmail: 'visitor@example.com',
        content: '待审核',
      });

      const updated = await commentService.updateCommentStatus({
        id: comment.id,
        status: BlogCommentStatus.APPROVED,
      });

      expect(updated.status).toBe(BlogCommentStatus.APPROVED);
    });

    it('嵌套层级超过上限时应抛出错误', async () => {
      const post = await postService.createPost({
        title: '嵌套测试',
        slug: 'nesting-test',
        content: '内容',
      });

      // 手动插入 nestingLevel=5 的评论来模拟边界
      const commentRepo = dataSource.getRepository(BlogCommentEntity);
      const level5 = commentRepo.create({
        postId: post.id,
        parentId: null,
        replyToId: null,
        authorName: '深层',
        authorEmail: 'deep@example.com',
        authorAvatar: null,
        content: '第5层',
        status: BlogCommentStatus.APPROVED,
        nestingLevel: 5,
      });
      await commentRepo.save(level5);

      await expect(
        commentService.createComment({
          postId: post.id,
          parentId: level5.id,
          authorName: '越界',
          authorEmail: 'overflow@example.com',
          content: '第6层',
        }),
      ).rejects.toThrow(DomainError);
    });
  });

  // ─── Like toggle ───

  describe('Like toggle', () => {
    it('应点赞并取消点赞', async () => {
      const post = await postService.createPost({
        title: '点赞测试',
        slug: 'like-test',
        content: '内容',
      });

      // 点赞
      const likeResult = await likeService.toggleLike(post.id, 'user1');
      expect(likeResult.liked).toBe(true);
      expect(likeResult.likeCount).toBe(1);

      // 取消点赞
      const unlikeResult = await likeService.toggleLike(post.id, 'user1');
      expect(unlikeResult.liked).toBe(false);
      expect(unlikeResult.likeCount).toBe(0);
    });

    it('文章不存在时应抛出错误', async () => {
      await expect(likeService.toggleLike(99999, 'user1')).rejects.toThrow(DomainError);
    });
  });

  // ─── Profile ───

  describe('Profile CRUD', () => {
    it('应创建和更新博主信息', async () => {
      const created = await profileService.createProfile('博主');
      expect(created.nickname).toBe('博主');

      const updated = await profileService.updateProfile(created.id, {
        bio: '个人简介',
        avatarUrl: 'https://example.com/avatar.png',
      });

      expect(updated.bio).toBe('个人简介');
      expect(updated.avatarUrl).toBe('https://example.com/avatar.png');
    });
  });

  // ─── Cross-aggregate read ───

  describe('跨聚合读取', () => {
    it('分类视图应包含正确的 postCount', async () => {
      const category = await categoryService.createCategory({ name: '技术', slug: 'tech' });

      await postService.createPost({
        title: '文章1',
        slug: 'post-1',
        content: '内容',
        categoryId: category.id,
        status: BlogPostStatus.PUBLISHED,
      });

      await postService.createPost({
        title: '文章2',
        slug: 'post-2',
        content: '内容',
        categoryId: category.id,
        status: BlogPostStatus.DRAFT,
      });

      const view = await categoryQueryService.findCategoryById(category.id);
      expect(view!.postCount).toBe(2);
    });

    it('文章视图应包含 categoryName', async () => {
      const category = await categoryService.createCategory({ name: '生活', slug: 'life' });

      const post = await postService.createPost({
        title: '生活文章',
        slug: 'life-post',
        content: '内容',
        categoryId: category.id,
      });

      const detail = await postQueryService.findPostById(post.id);
      expect(detail!.categoryName).toBe('生活');
    });

    it('批量查询文章应正确映射 categoryName', async () => {
      const cat1 = await categoryService.createCategory({ name: '技术', slug: 'tech' });
      const cat2 = await categoryService.createCategory({ name: '生活', slug: 'life' });

      const post1 = await postService.createPost({
        title: '技术文章',
        slug: 'tech-post',
        content: '内容',
        categoryId: cat1.id,
      });

      const post2 = await postService.createPost({
        title: '生活文章',
        slug: 'life-post',
        content: '内容',
        categoryId: cat2.id,
      });

      const views = await postQueryService.findPostsByIdsForViewMapping([post1.id, post2.id]);

      expect(views).toHaveLength(2);
      expect(views[0].categoryName).toBe('技术');
      expect(views[1].categoryName).toBe('生活');
    });
  });

  // ─── File upload/delete ───

  describe('File upload & delete', () => {
    it('应上传文件并查询到记录', async () => {
      const uploaded = await fileService.uploadFile({
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
        fileSize: 1024,
        storedName: 'test-abc123.jpg',
        fileType: BlogFileType.IMAGE,
        buffer: Buffer.from('fake-image-data'),
      });

      expect(uploaded.id).toBeDefined();
      expect(uploaded.originalName).toBe('test.jpg');
      expect(uploaded.mimeType).toBe('image/jpeg');
      expect(uploaded.storagePath).toContain('test-abc123.jpg');
    });

    it('应软删除文件记录并返回 storagePath', async () => {
      const uploaded = await fileService.uploadFile({
        originalName: 'delete-test.png',
        mimeType: 'image/png',
        fileSize: 2048,
        storedName: 'delete-test-abc.png',
        fileType: BlogFileType.IMAGE,
        buffer: Buffer.from('fake-png-data'),
      });

      const storagePath = await fileService.softDeleteFile(uploaded.id);
      expect(storagePath).toContain('delete-test-abc.png');
    });

    it('删除不存在的文件时应抛出 FILE_NOT_FOUND', async () => {
      await expect(fileService.softDeleteFile(99999)).rejects.toThrow(DomainError);
    });

    it('上传不支持的 MIME 类型时应抛出 FILE_TYPE_NOT_ALLOWED', async () => {
      await expect(
        fileService.uploadFile({
          originalName: 'malware.exe',
          mimeType: 'application/x-executable',
          fileSize: 1024,
          storedName: 'malware.exe',
          fileType: BlogFileType.OTHER,
          buffer: Buffer.from('evil'),
        }),
      ).rejects.toThrow(DomainError);
    });

    it('上传超大文件时应抛出 FILE_SIZE_EXCEEDED', async () => {
      await expect(
        fileService.uploadFile({
          originalName: 'huge.jpg',
          mimeType: 'image/jpeg',
          fileSize: 100 * 1024 * 1024, // 100MB
          storedName: 'huge.jpg',
          fileType: BlogFileType.IMAGE,
          buffer: Buffer.from('x'),
        }),
      ).rejects.toThrow(DomainError);
    });
  });

  // ─── Profile update (extended) ───

  describe('Profile update (extended)', () => {
    it('应更新 socialLinks 字段', async () => {
      const created = await profileService.createProfile('博主');
      const socialLinks = {
        github: 'https://github.com/test',
        twitter: 'https://twitter.com/test',
      };

      const updated = await profileService.updateProfile(created!.id, { socialLinks });

      expect(updated.socialLinks).toEqual(socialLinks);
    });

    it('应清空可选字段（传 null）', async () => {
      const created = await profileService.createProfile('博主');
      const withBio = await profileService.updateProfile(created!.id, { bio: '有简介' });
      expect(withBio.bio).toBe('有简介');

      const cleared = await profileService.updateProfile(created!.id, { bio: null });
      expect(cleared.bio).toBeNull();
    });

    it('更新不存在的 profile 时应抛出 PROFILE_NOT_FOUND', async () => {
      await expect(profileService.updateProfile(99999, { nickname: '不存在' })).rejects.toThrow(
        DomainError,
      );
    });

    it('应通过 QueryService 查询到更新后的 profile', async () => {
      const created = await profileService.createProfile('博主');
      await profileService.updateProfile(created!.id, { nickname: '新昵称', bio: '新简介' });

      const view = await profileQueryService.findProfileById(created!.id);
      expect(view).not.toBeNull();
      expect(view!.nickname).toBe('新昵称');
      expect(view!.bio).toBe('新简介');
    });
  });
});
