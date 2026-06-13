// Blog baseline 拆分批次第五段：插入 mahiru 博主初始数据到 blog_profile 表
// 第一段见 1773930000000-create-blog-tables.migration.ts
// 第二段见 1773930100000-add-blog-comment-is-admin-reply.migration.ts
// 第三段见 1773930200000-create-blog-friend-link-table.migration.ts
// 第四段见 1773930300000-add-blog-comment-is-hidden.migration.ts
// 当前阶段仍为 baseline 建库模式，部署前须通过空库 migration 演练验证

import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedBlogProfileMahiru1773930400000 implements MigrationInterface {
  name = 'SeedBlogProfileMahiru1773930400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO \`blog_profile\` (\`nickname\`, \`bio\`, \`avatar_url\`, \`social_links\`) SELECT 'mahiru', '全栈开发者，热爱技术与写作', NULL, NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM \`blog_profile\` WHERE \`nickname\` = 'mahiru')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM \`blog_profile\` WHERE \`nickname\` = 'mahiru' LIMIT 1`);
  }
}
