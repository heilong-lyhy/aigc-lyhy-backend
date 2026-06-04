import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('blog_profile')
@Index('idx_blog_profile_deleted_at', ['deletedAt'])
export class BlogProfileEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true, comment: '博主信息 ID' })
  id!: number;

  @Column({ name: 'nickname', type: 'varchar', length: 100, comment: '博主昵称' })
  nickname!: string;

  @Column({ name: 'bio', type: 'text', nullable: true, comment: '个人简介' })
  bio!: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 512, nullable: true, comment: '头像 URL' })
  avatarUrl!: string | null;

  @Column({ name: 'social_links', type: 'json', nullable: true, comment: '社交链接 JSON' })
  socialLinks!: Record<string, string> | null;

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

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
    comment: '软删除时间',
  })
  deletedAt!: Date | null;
}
