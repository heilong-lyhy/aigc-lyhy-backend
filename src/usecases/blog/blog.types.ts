// src/usecases/blog/blog.types.ts
// Blog usecases 共享类型：多个 usecase 共用的参数/结果类型
// 单个 usecase 私有类型直接放在该 usecase 文件中

import type { BlogPostDetailView } from '@modules/blog/blog.types';

/** 文章写操作通用结果 */
export interface BlogPostWriteResult {
  readonly post: BlogPostDetailView;
}
