import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('blog_post_tag')
@Index('uk_blog_post_tag_post_tag', ['postId', 'tagId'], { unique: true })
@Index('idx_blog_post_tag_tag_id', ['tagId'])
export class BlogPostTagEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true, comment: '关联 ID' })
  id!: number;

  @Column({ name: 'post_id', type: 'int', unsigned: true, comment: '文章 ID' })
  postId!: number;

  @Column({ name: 'tag_id', type: 'int', unsigned: true, comment: '标签 ID' })
  tagId!: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
    comment: '创建时间',
  })
  createdAt!: Date;
}
