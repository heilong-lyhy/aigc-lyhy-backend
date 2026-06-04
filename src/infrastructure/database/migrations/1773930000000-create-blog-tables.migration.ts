import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBlogTables1773930000000 implements MigrationInterface {
  name = 'CreateBlogTables1773930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createBlogPost(queryRunner);
    await this.createBlogCategory(queryRunner);
    await this.createBlogTag(queryRunner);
    await this.createBlogPostTag(queryRunner);
    await this.createBlogComment(queryRunner);
    await this.createBlogLike(queryRunner);
    await this.createBlogFile(queryRunner);
    await this.createBlogProfile(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `blog_like`;');
    await queryRunner.query('DROP TABLE `blog_comment`;');
    await queryRunner.query('DROP TABLE `blog_post_tag`;');
    await queryRunner.query('DROP TABLE `blog_post`;');
    await queryRunner.query('DROP TABLE `blog_tag`;');
    await queryRunner.query('DROP TABLE `blog_category`;');
    await queryRunner.query('DROP TABLE `blog_file`;');
    await queryRunner.query('DROP TABLE `blog_profile`;');
  }

  private async createBlogPost(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`blog_post\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`title\` varchar(255) NOT NULL COMMENT '文章标题',
        \`slug\` varchar(255) NOT NULL COMMENT 'URL slug（唯一）',
        \`excerpt\` text DEFAULT NULL COMMENT '摘要',
        \`content\` longtext NOT NULL COMMENT 'Markdown 原文',
        \`rendered_content\` longtext DEFAULT NULL COMMENT '预渲染 HTML',
        \`cover_image\` varchar(512) DEFAULT NULL COMMENT '封面图 URL',
        \`status\` enum('DRAFT','PUBLISHED','ARCHIVED','DELETED') NOT NULL DEFAULT 'DRAFT' COMMENT '文章状态',
        \`category_id\` int unsigned DEFAULT NULL COMMENT '分类 ID',
        \`view_count\` int unsigned NOT NULL DEFAULT 0 COMMENT '浏览量',
        \`like_count\` int unsigned NOT NULL DEFAULT 0 COMMENT '点赞数',
        \`comment_count\` int unsigned NOT NULL DEFAULT 0 COMMENT '评论数',
        \`is_pinned\` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否置顶',
        \`published_at\` timestamp(3) NULL DEFAULT NULL COMMENT '发布时间',
        \`deleted_at\` timestamp(3) NULL DEFAULT NULL COMMENT '软删除时间',
        \`created_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
        \`updated_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_blog_post_slug\` (\`slug\`),
        KEY \`idx_blog_post_status\` (\`status\`),
        KEY \`idx_blog_post_category_id\` (\`category_id\`),
        KEY \`idx_blog_post_deleted_at\` (\`deleted_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='博客文章';
    `);
  }

  private async createBlogCategory(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`blog_category\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`name\` varchar(100) NOT NULL COMMENT '分类名称',
        \`slug\` varchar(100) NOT NULL COMMENT 'URL slug（唯一）',
        \`description\` varchar(512) DEFAULT NULL COMMENT '分类描述',
        \`parent_id\` int unsigned DEFAULT NULL COMMENT '父分类 ID（自关联）',
        \`sort_order\` int unsigned NOT NULL DEFAULT 0 COMMENT '排序权重',
        \`deleted_at\` timestamp(3) NULL DEFAULT NULL COMMENT '软删除时间',
        \`created_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
        \`updated_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_blog_category_slug\` (\`slug\`),
        KEY \`idx_blog_category_parent_id\` (\`parent_id\`),
        KEY \`idx_blog_category_deleted_at\` (\`deleted_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='博客分类';
    `);
  }

  private async createBlogTag(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`blog_tag\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`name\` varchar(100) NOT NULL COMMENT '标签名称',
        \`slug\` varchar(100) NOT NULL COMMENT 'URL slug（唯一）',
        \`deleted_at\` timestamp(3) NULL DEFAULT NULL COMMENT '软删除时间',
        \`created_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
        \`updated_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_blog_tag_slug\` (\`slug\`),
        KEY \`idx_blog_tag_deleted_at\` (\`deleted_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='博客标签';
    `);
  }

  private async createBlogPostTag(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`blog_post_tag\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`post_id\` int unsigned NOT NULL COMMENT '文章 ID',
        \`tag_id\` int unsigned NOT NULL COMMENT '标签 ID',
        \`created_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_blog_post_tag_post_tag\` (\`post_id\`, \`tag_id\`),
        KEY \`idx_blog_post_tag_tag_id\` (\`tag_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='文章-标签关联';
    `);
  }

  private async createBlogComment(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`blog_comment\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`post_id\` int unsigned NOT NULL COMMENT '文章 ID',
        \`parent_id\` int unsigned DEFAULT NULL COMMENT '直接父评论 ID（楼中楼）',
        \`reply_to_id\` int unsigned DEFAULT NULL COMMENT '被回复评论 ID（@对象）',
        \`author_name\` varchar(100) NOT NULL COMMENT '评论者昵称',
        \`author_email\` varchar(255) NOT NULL COMMENT '评论者邮箱',
        \`author_url\` varchar(512) DEFAULT NULL COMMENT '评论者网站',
        \`author_avatar\` varchar(512) DEFAULT NULL COMMENT '评论者头像 URL',
        \`content\` text NOT NULL COMMENT '评论内容',
        \`status\` enum('PENDING','APPROVED','REJECTED','SPAM') NOT NULL DEFAULT 'PENDING' COMMENT '审核状态',
        \`nesting_level\` tinyint unsigned NOT NULL DEFAULT 0 COMMENT '嵌套层级（最大 5）',
        \`deleted_at\` timestamp(3) NULL DEFAULT NULL COMMENT '软删除时间',
        \`created_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
        \`updated_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
        PRIMARY KEY (\`id\`),
        KEY \`idx_blog_comment_post_id\` (\`post_id\`),
        KEY \`idx_blog_comment_parent_id\` (\`parent_id\`),
        KEY \`idx_blog_comment_status\` (\`status\`),
        KEY \`idx_blog_comment_deleted_at\` (\`deleted_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='博客评论';
    `);
  }

  private async createBlogLike(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`blog_like\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`post_id\` int unsigned NOT NULL COMMENT '文章 ID',
        \`user_identifier\` varchar(255) NOT NULL COMMENT '用户标识（userId 或 IP+UA 哈希）',
        \`created_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_blog_like_post_user\` (\`post_id\`, \`user_identifier\`) COMMENT '唯一点赞（同用户对同文章仅一次）'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='博客点赞';
    `);
  }

  private async createBlogFile(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`blog_file\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`original_name\` varchar(255) NOT NULL COMMENT '原始文件名',
        \`stored_name\` varchar(255) NOT NULL COMMENT '存储文件名',
        \`mime_type\` varchar(128) NOT NULL COMMENT 'MIME 类型',
        \`file_size\` bigint unsigned NOT NULL COMMENT '文件大小（字节）',
        \`storage_path\` varchar(512) NOT NULL COMMENT '存储路径',
        \`file_type\` enum('IMAGE','DOCUMENT','OTHER') NOT NULL COMMENT '文件类型',
        \`deleted_at\` timestamp(3) NULL DEFAULT NULL COMMENT '软删除时间',
        \`created_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
        \`updated_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
        PRIMARY KEY (\`id\`),
        KEY \`idx_blog_file_deleted_at\` (\`deleted_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='博客文件';
    `);
  }

  private async createBlogProfile(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`blog_profile\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`nickname\` varchar(100) NOT NULL COMMENT '博主昵称',
        \`bio\` text DEFAULT NULL COMMENT '个人简介',
        \`avatar_url\` varchar(512) DEFAULT NULL COMMENT '头像 URL',
        \`social_links\` json DEFAULT NULL COMMENT '社交链接 JSON',
        \`deleted_at\` timestamp(3) NULL DEFAULT NULL COMMENT '软删除时间',
        \`created_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
        \`updated_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
        PRIMARY KEY (\`id\`),
        KEY \`idx_blog_profile_deleted_at\` (\`deleted_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='博主信息';
    `);
  }
}
