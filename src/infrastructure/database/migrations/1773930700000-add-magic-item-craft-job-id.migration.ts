// src/infrastructure/database/migrations/1773930700000-add-magic-item-craft-job-id.migration.ts
// 为 magic_item_craft_task 表添加 job_id 列，用于关联 BullMQ 队列 Job

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMagicItemCraftJobId1773930700000 implements MigrationInterface {
  name = 'AddMagicItemCraftJobId1773930700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`magic_item_craft_task\`
        ADD COLUMN \`job_id\` varchar(128) DEFAULT NULL COMMENT 'BullMQ 队列 Job ID' AFTER \`trace_id\`;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`magic_item_craft_task\`
        DROP COLUMN \`job_id\`;
    `);
  }
}
