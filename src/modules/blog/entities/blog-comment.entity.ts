import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BlogCommentStatus } from '@app-types/models/blog.types';

@Entity('blog_comment')
@Index('idx_blog_comment_post_id', ['postId'])
@Index('idx_blog_comment_parent_id', ['parentId'])
@Index('idx_blog_comment_status', ['status'])
@Index('idx_blog_comment_deleted_at', ['deletedAt'])
export class BlogCommentEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true, comment: '评论 ID' })
  id!: number;

  @Column({ name: 'post_id', type: 'int', unsigned: true, comment: '文章 ID' })
  postId!: number;

  @Column({
    name: 'parent_id',
    type: 'int',
    unsigned: true,
    nullable: true,
    comment: '直接父评论 ID（楼中楼）',
  })
  parentId!: number | null;

  @Column({
    name: 'reply_to_id',
    type: 'int',
    unsigned: true,
    nullable: true,
    comment: '被回复评论 ID（@对象）',
  })
  replyToId!: number | null;

  @Column({ name: 'author_name', type: 'varchar', length: 100, comment: '评论者昵称' })
  authorName!: string;

  @Column({ name: 'author_email', type: 'varchar', length: 255, comment: '评论者邮箱' })
  authorEmail!: string;

  @Column({
    name: 'author_url',
    type: 'varchar',
    length: 512,
    nullable: true,
    comment: '评论者网站',
  })
  authorUrl!: string | null;

  @Column({
    name: 'author_avatar',
    type: 'varchar',
    length: 512,
    nullable: true,
    comment: '评论者头像 URL',
  })
  authorAvatar!: string | null;

  @Column({ name: 'content', type: 'text', comment: '评论内容' })
  content!: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: BlogCommentStatus,
    default: BlogCommentStatus.PENDING,
    comment: '审核状态',
  })
  status!: BlogCommentStatus;

  @Column({
    name: 'nesting_level',
    type: 'tinyint',
    unsigned: true,
    default: 0,
    comment: '嵌套层级（最大 5）',
  })
  nestingLevel!: number;

  @Column({
    name: 'is_admin_reply',
    type: 'boolean',
    default: false,
    comment: '是否为管理员回复',
  })
  isAdminReply!: boolean;

  @Column({
    name: 'is_hidden',
    type: 'boolean',
    default: false,
    comment: '是否隐藏（违规下架但保留记录）',
  })
  isHidden!: boolean;

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
