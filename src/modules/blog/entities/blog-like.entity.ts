import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('blog_like')
@Index('uk_blog_like_post_user', ['postId', 'userIdentifier'], { unique: true })
export class BlogLikeEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true, comment: '点赞 ID' })
  id!: number;

  @Column({ name: 'post_id', type: 'int', unsigned: true, comment: '文章 ID' })
  postId!: number;

  @Column({
    name: 'user_identifier',
    type: 'varchar',
    length: 255,
    comment: '用户标识（userId 或 IP+UA 哈希）',
  })
  userIdentifier!: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
    comment: '创建时间',
  })
  createdAt!: Date;
}
