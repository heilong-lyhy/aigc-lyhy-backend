// 修复 base_user_info.meta_digest 中的非 JSON 旧数据
// 问题：加密系统引入前，meta_digest 存储了 SHA256 hash 等非 JSON 格式的字符串
//       decryptEntity 解密这些数据会失败并跳过，导致 validateAccessGroupConsistency
//       收到的是字符串而非数组，触发账户自动暂停
// 修复：将非 JSON 格式的 meta_digest 替换为与 access_group 一致的明文 JSON 数组
//       下次应用写入时 FieldEncryptionSubscriber 会自动加密

import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixMetaDigestLegacyData1773940000000 implements MigrationInterface {
  name = 'FixMetaDigestLegacyData1773940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 将非 JSON 格式的 meta_digest 替换为与 access_group 一致的值
    // VALID_JSON_CHECK: JSON_VALID 是 MySQL 8.0+ 内置函数，返回 1 表示合法 JSON
    // 只更新 meta_digest 不是合法 JSON 的行，避免覆盖已加密的合法数据
    await queryRunner.query(`
      UPDATE \`base_user_info\`
      SET \`meta_digest\` = \`access_group\`
      WHERE \`meta_digest\` IS NOT NULL
        AND NOT JSON_VALID(\`meta_digest\`)
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // 数据修复 migration 不支持安全回滚，原始 hash 值已丢失
  }
}
