import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMagicItemCraftTaskTable1773930600000 implements MigrationInterface {
  name = 'CreateMagicItemCraftTaskTable1773930600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`magic_item_craft_task\` (
        \`id\` char(36) NOT NULL COMMENT '主键UUID',
        \`trace_id\` varchar(128) NOT NULL COMMENT '链路追踪 ID',
        \`item_name\` varchar(255) NOT NULL COMMENT '物品名称',
        \`item_type\` enum('WEAPON','ARMOR','TOOL','TOY') NOT NULL COMMENT '物品类型',
        \`material_level\` tinyint unsigned NOT NULL COMMENT '素材等级',
        \`request_note\` text DEFAULT NULL COMMENT '锻造请求备注',
        \`status\` enum('PENDING','PROCESSING','SUCCEEDED','FAILED') NOT NULL DEFAULT 'PENDING' COMMENT '任务状态',
        \`quality_level\` enum('COMMON','RARE','EPIC','LEGENDARY') DEFAULT NULL COMMENT '品质等级',
        \`result_description\` text DEFAULT NULL COMMENT '结果描述',
        \`craft_log\` text DEFAULT NULL COMMENT '锻造日志',
        \`failure_reason\` varchar(255) DEFAULT NULL COMMENT '失败原因',
        \`created_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
        \`updated_at\` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间',
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`idx_trace_id\` (\`trace_id\`),
        KEY \`idx_status\` (\`status\`),
        KEY \`idx_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='魔法物品锻造任务表';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `magic_item_craft_task`;');
  }
}
