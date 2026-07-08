import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  MagicItemCraftTaskQualityLevel,
  MagicItemCraftTaskStatus,
  MagicItemCraftTaskType,
} from '@app-types/models/magic-item-craft.types';

@Entity('magic_item_craft_task')
@Index('idx_trace_id', ['traceId'], { unique: true })
@Index('idx_status', ['status'])
@Index('idx_created_at', ['createdAt'])
export class MagicItemCraftTaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trace_id', type: 'varchar', length: 128 })
  traceId!: string;

  @Column({ name: 'item_name', type: 'varchar', length: 255 })
  itemName!: string;

  @Column({
    name: 'item_type',
    type: 'enum',
    enum: MagicItemCraftTaskType,
  })
  itemType!: MagicItemCraftTaskType;

  @Column({ name: 'material_level', type: 'tinyint', unsigned: true })
  materialLevel!: number;

  @Column({ name: 'request_note', type: 'text', nullable: true })
  requestNote!: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: MagicItemCraftTaskStatus,
    default: MagicItemCraftTaskStatus.PENDING,
  })
  status!: MagicItemCraftTaskStatus;

  @Column({
    name: 'quality_level',
    type: 'enum',
    enum: MagicItemCraftTaskQualityLevel,
    nullable: true,
  })
  qualityLevel!: MagicItemCraftTaskQualityLevel | null;

  @Column({ name: 'result_description', type: 'text', nullable: true })
  resultDescription!: string | null;

  @Column({ name: 'craft_log', type: 'text', nullable: true })
  craftLog!: string | null;

  @Column({ name: 'failure_reason', type: 'varchar', length: 255, nullable: true })
  failureReason!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
    onUpdate: 'CURRENT_TIMESTAMP(3)',
  })
  updatedAt!: Date;
}
