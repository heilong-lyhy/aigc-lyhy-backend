// src/modules/blog/entities/blog-friend-link.entity.ts
// 友情链接聚合根实体

import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('blog_friend_link')
export class BlogFriendLinkEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true, comment: '友链 ID' })
  id!: number;

  @Column({ name: 'name', type: 'varchar', length: 100, comment: '站点名称' })
  name!: string;

  @Column({ name: 'url', type: 'varchar', length: 500, comment: '站点 URL' })
  url!: string;

  @Column({
    name: 'description',
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: '站点描述',
  })
  description!: string | null;

  @Column({
    name: 'logo_url',
    type: 'varchar',
    length: 500,
    nullable: true,
    comment: 'Logo URL',
  })
  logoUrl!: string | null;

  @Column({
    name: 'sort_order',
    type: 'int',
    unsigned: true,
    default: 0,
    comment: '排序（越小越靠前）',
  })
  sortOrder!: number;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
    comment: '是否启用',
  })
  isActive!: boolean;

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
