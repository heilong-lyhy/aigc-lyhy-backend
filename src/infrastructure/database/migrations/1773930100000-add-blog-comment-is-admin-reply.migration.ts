// Blog baseline 拆分批次第二段：在 blog_comment 表新增 is_admin_reply 字段
// 第一段见 1773930000000-create-blog-tables.migration.ts
// 当前阶段仍为 baseline 建库模式，部署前须通过空库 migration 演练验证

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlogCommentIsAdminReply1773930100000 implements MigrationInterface {
  name = 'AddBlogCommentIsAdminReply1773930100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`blog_comment\` ADD \`is_admin_reply\` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否为管理员回复' AFTER \`nesting_level\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`blog_comment\` DROP COLUMN \`is_admin_reply\``);
  }
}
