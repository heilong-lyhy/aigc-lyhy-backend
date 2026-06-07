// src/types/models/blog.types.ts
// 博客领域跨域共享枚举（L1：全局共享类型）
// 仅包含需要跨域复用或在 adapter 层运行时注册的枚举
// 同域 View / Input 类型保留在 src/modules/blog/blog.types.ts

/** 文章状态 */
export enum BlogPostStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

/** 评论审核状态 */
export enum BlogCommentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SPAM = 'SPAM',
}

/** 博客文件类型 */
export enum BlogFileType {
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  OTHER = 'OTHER',
}
