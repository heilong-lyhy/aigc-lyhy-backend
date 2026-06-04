import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BlogFileType } from '../blog.types';

@Entity('blog_file')
@Index('idx_blog_file_deleted_at', ['deletedAt'])
export class BlogFileEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true, comment: '文件 ID' })
  id!: number;

  @Column({ name: 'original_name', type: 'varchar', length: 255, comment: '原始文件名' })
  originalName!: string;

  @Column({ name: 'stored_name', type: 'varchar', length: 255, comment: '存储文件名' })
  storedName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 128, comment: 'MIME 类型' })
  mimeType!: string;

  @Column({ name: 'file_size', type: 'bigint', unsigned: true, comment: '文件大小（字节）' })
  fileSize!: number;

  @Column({ name: 'storage_path', type: 'varchar', length: 512, comment: '存储路径' })
  storagePath!: string;

  @Column({
    name: 'file_type',
    type: 'enum',
    enum: BlogFileType,
    comment: '文件类型',
  })
  fileType!: BlogFileType;

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
