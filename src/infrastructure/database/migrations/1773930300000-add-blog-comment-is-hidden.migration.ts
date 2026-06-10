// Blog baseline 拆分批次第四段：在 blog_comment 表新增 is_hidden 字段
// 第一段见 1773930000000-create-blog-tables.migration.ts
// 第二段见 1773930100000-add-blog-comment-is-admin-reply.migration.ts
// 第三段见 1773930200000-create-blog-friend-link-table.migration.ts
// 当前阶段仍为 baseline 建库模式，部署前须通过空库 migration 演练验证

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlogCommentIsHidden1773930300000 implements MigrationInterface {
  name = 'AddBlogCommentIsHidden1773930300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`blog_comment\` ADD \`is_hidden\` tinyint(1) NOT NULL DEFAULT 0 COMMENT '是否隐藏（违规下架但保留记录）' AFTER \`is_admin_reply\``,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`blog_comment\` DROP COLUMN \`is_hidden\``);
  }
}
