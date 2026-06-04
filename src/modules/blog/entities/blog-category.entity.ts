import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('blog_category')
@Index('uk_blog_category_slug', ['slug'], { unique: true })
@Index('idx_blog_category_parent_id', ['parentId'])
@Index('idx_blog_category_deleted_at', ['deletedAt'])
export class BlogCategoryEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true, comment: '分类 ID' })
  id!: number;

  @Column({ name: 'name', type: 'varchar', length: 100, comment: '分类名称' })
  name!: string;

  @Column({ name: 'slug', type: 'varchar', length: 100, comment: 'URL slug（唯一）' })
  slug!: string;

  @Column({
    name: 'description',
    type: 'varchar',
    length: 512,
    nullable: true,
    comment: '分类描述',
  })
  description!: string | null;

  @Column({
    name: 'parent_id',
    type: 'int',
    unsigned: true,
    nullable: true,
    comment: '父分类 ID（自关联）',
  })
  parentId!: number | null;

  @Column({ name: 'sort_order', type: 'int', unsigned: true, default: 0, comment: '排序权重' })
  sortOrder!: number;

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
