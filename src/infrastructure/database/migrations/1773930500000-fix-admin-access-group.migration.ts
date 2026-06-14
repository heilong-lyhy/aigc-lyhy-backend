// 修复 ADMIN 账户的 access_group 数据
// 问题：非 mahiru 的 ADMIN 账户无法使用 Blog Admin
// 根因：部分 ADMIN 账户在 base_user_info.access_group 中未包含 "ADMIN" 角色
// 修复：基于 base_user_account.identity_hint = 'ADMIN' 识别 ADMIN 账户，
//       确保其 base_user_info.access_group 包含 "ADMIN"

import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixAdminAccessGroup1773930500000 implements MigrationInterface {
  name = 'FixAdminAccessGroup1773930500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 修复 identity_hint = 'ADMIN' 但 access_group 不包含 'ADMIN' 的账户
    // 将 access_group 和 meta_digest 同步追加 'ADMIN'（保留已有角色）
    // 注意：meta_digest 必须与 access_group 保持一致，否则登录时
    // AccountSecurityService.validateAccessGroupConsistency 会判定不一致并暂停账户
    // 使用 IFNULL 处理 meta_digest 为 NULL 的边界情况：
    //   JSON_ARRAY_APPEND(NULL, '$', 'ADMIN') 返回 NULL，需回退到 access_group 追加后的值
    await queryRunner.query(`
      UPDATE \`base_user_info\` ui
      INNER JOIN \`base_user_account\` ua ON ui.account_id = ua.id
      SET ui.access_group = JSON_ARRAY_APPEND(ui.access_group, '$', 'ADMIN'),
          ui.meta_digest = IFNULL(
            JSON_ARRAY_APPEND(ui.meta_digest, '$', 'ADMIN'),
            JSON_ARRAY_APPEND(ui.access_group, '$', 'ADMIN')
          )
      WHERE ua.identity_hint = 'ADMIN'
        AND NOT JSON_CONTAINS(ui.access_group, '"ADMIN"', '$')
    `);

    // 修复 identity_hint = 'STAFF' 但 access_group 不包含 'STAFF' 的账户
    await queryRunner.query(`
      UPDATE \`base_user_info\` ui
      INNER JOIN \`base_user_account\` ua ON ui.account_id = ua.id
      SET ui.access_group = JSON_ARRAY_APPEND(ui.access_group, '$', 'STAFF'),
          ui.meta_digest = IFNULL(
            JSON_ARRAY_APPEND(ui.meta_digest, '$', 'STAFF'),
            JSON_ARRAY_APPEND(ui.access_group, '$', 'STAFF')
          )
      WHERE ua.identity_hint = 'STAFF'
        AND NOT JSON_CONTAINS(ui.access_group, '"STAFF"', '$')
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // 数据修复 migration 不支持安全回滚，因为无法确定哪些 'ADMIN'/'STAFF' 是本次添加的
    // 如需回滚，请手动检查并修正 access_group 数据
  }
}
