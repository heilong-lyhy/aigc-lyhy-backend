// Blog baseline 拆分批次第三段：创建 blog_friend_link 表
// 第一段见 1773930000000-create-blog-tables.migration.ts
// 第二段见 1773930100000-add-blog-comment-is-admin-reply.migration.ts
// 当前阶段仍为 baseline 建库模式，部署前须通过空库 migration 演练验证

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBlogFriendLinkTable1773930200000 implements MigrationInterface {
  name = 'CreateBlogFriendLinkTable1773930200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`blog_friend_link\` (
        \`id\` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`name\` VARCHAR(100) NOT NULL COMMENT '站点名称',
        \`url\` VARCHAR(500) NOT NULL COMMENT '站点 URL',
        \`description\` VARCHAR(500) DEFAULT NULL COMMENT '站点描述',
        \`logo_url\` VARCHAR(500) DEFAULT NULL COMMENT 'Logo URL',
        \`sort_order\` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '排序（越小越靠前）',
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
        \`deleted_at\` TIMESTAMP(3) NULL DEFAULT NULL COMMENT '软删除时间',
        \`created_at\` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
        \`updated_at\` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='友情链接'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`blog_friend_link\``);
  }
}
