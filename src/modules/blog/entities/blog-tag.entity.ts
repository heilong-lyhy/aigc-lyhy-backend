import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('blog_tag')
@Index('uk_blog_tag_slug', ['slug'], { unique: true })
@Index('idx_blog_tag_deleted_at', ['deletedAt'])
export class BlogTagEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true, comment: '标签 ID' })
  id!: number;

  @Column({ name: 'name', type: 'varchar', length: 100, comment: '标签名称' })
  name!: string;

  @Column({ name: 'slug', type: 'varchar', length: 100, comment: 'URL slug（唯一）' })
  slug!: string;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
    comment: '软删除时间',
  })
  deletedAt!: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
    comment: '创建时间',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
    onUpdate: 'CURRENT_TIMESTAMP(3)',
    comment: '更新时间',
  })
  updatedAt!: Date;
}
