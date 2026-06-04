import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BlogPostStatus } from '../blog.types';

@Entity('blog_post')
@Index('uk_blog_post_slug', ['slug'], { unique: true })
@Index('idx_blog_post_status', ['status'])
@Index('idx_blog_post_category_id', ['categoryId'])
@Index('idx_blog_post_deleted_at', ['deletedAt'])
export class BlogPostEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true, comment: '文章 ID' })
  id!: number;

  @Column({ name: 'title', type: 'varchar', length: 255, comment: '文章标题' })
  title!: string;

  @Column({ name: 'slug', type: 'varchar', length: 255, comment: 'URL slug（唯一）' })
  slug!: string;

  @Column({ name: 'excerpt', type: 'text', nullable: true, comment: '摘要' })
  excerpt!: string | null;

  @Column({ name: 'content', type: 'longtext', comment: 'Markdown 原文' })
  content!: string;

  @Column({ name: 'rendered_content', type: 'longtext', nullable: true, comment: '预渲染 HTML' })
  renderedContent!: string | null;

  @Column({
    name: 'cover_image',
    type: 'varchar',
    length: 512,
    nullable: true,
    comment: '封面图 URL',
  })
  coverImage!: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: BlogPostStatus,
    default: BlogPostStatus.DRAFT,
    comment: '文章状态',
  })
  status!: BlogPostStatus;

  @Column({ name: 'category_id', type: 'int', unsigned: true, nullable: true, comment: '分类 ID' })
  categoryId!: number | null;

  @Column({ name: 'view_count', type: 'int', unsigned: true, default: 0, comment: '浏览量' })
  viewCount!: number;

  @Column({ name: 'like_count', type: 'int', unsigned: true, default: 0, comment: '点赞数' })
  likeCount!: number;

  @Column({ name: 'comment_count', type: 'int', unsigned: true, default: 0, comment: '评论数' })
  commentCount!: number;

  @Column({ name: 'is_pinned', type: 'boolean', default: false, comment: '是否置顶' })
  isPinned!: boolean;

  @Column({
    name: 'published_at',
    type: 'timestamp',
    precision: 3,
    nullable: true,
    comment: '发布时间',
  })
  publishedAt!: Date | null;

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
