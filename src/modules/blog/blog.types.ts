// src/modules/blog/blog.types.ts
// 博客领域 L2 bounded context 公共类型：同域 adapter/usecase/modules 共享的 View 与 Input 类型
//
// 聚合根归属（写入阶段须遵守）：
// - BlogPost 聚合根：BlogPostEntity + BlogPostTagEntity（子实体，通过 BlogPost 聚合根写入）
// - BlogCategory 聚合根：BlogCategoryEntity（独立聚合根）
// - BlogTag 聚合根：BlogTagEntity（独立聚合根）
// - BlogComment 聚合根：BlogCommentEntity（独立聚合根）
// - BlogLike 聚合根：BlogLikeEntity（独立聚合根）
// - BlogFile 聚合根：BlogFileEntity（独立聚合根）
// - BlogProfile 聚合根：BlogProfileEntity（独立聚合根，单例）

// ─── 领域枚举（L1：跨域共享，真源在 src/types/models/blog.types.ts） ───
// 枚举统一从 @app-types/models/blog.types 导入，不在 L2 再导出

import { BlogPostStatus, BlogCommentStatus, BlogFileType } from '@app-types/models/blog.types';

// ─── View 类型 ───

/** 文章视图（列表页） */
export interface BlogPostView {
  readonly id: number;
  readonly title: string;
  readonly slug: string;
  readonly excerpt: string | null;
  readonly coverImage: string | null;
  readonly status: BlogPostStatus;
  readonly categoryId: number | null;
  readonly categoryName: string | null;
  readonly viewCount: number;
  readonly likeCount: number;
  readonly commentCount: number;
  readonly isPinned: boolean;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** 文章详情视图（含 Markdown content、标签列表、评论统计） */
export interface BlogPostDetailView {
  readonly id: number;
  readonly title: string;
  readonly slug: string;
  readonly excerpt: string | null;
  readonly content: string;
  readonly renderedContent: string | null;
  readonly coverImage: string | null;
  readonly status: BlogPostStatus;
  readonly categoryId: number | null;
  readonly categoryName: string | null;
  readonly tags: BlogTagView[];
  readonly viewCount: number;
  readonly likeCount: number;
  readonly commentCount: number;
  readonly isPinned: boolean;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** 分类视图 */
export interface BlogCategoryView {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly parentId: number | null;
  readonly sortOrder: number;
  readonly postCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** 分类树形视图 */
export interface BlogCategoryTreeView extends BlogCategoryView {
  readonly children: BlogCategoryTreeView[];
}

/** 标签视图 */
export interface BlogTagView {
  readonly id: number;
  readonly name: string;
  readonly slug: string;
  readonly postCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** 评论视图 */
export interface BlogCommentView {
  readonly id: number;
  readonly postId: number;
  readonly parentId: number | null;
  readonly replyToId: number | null;
  readonly authorName: string;
  readonly authorAvatar: string | null;
  readonly content: string;
  readonly status: BlogCommentStatus;
  readonly nestingLevel: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** 点赞视图 */
export interface BlogLikeView {
  readonly id: number;
  readonly postId: number;
  readonly userIdentifier: string;
  readonly createdAt: Date;
}

/** 文件视图 */
export interface BlogFileView {
  readonly id: number;
  readonly originalName: string;
  readonly storedName: string;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly storagePath: string;
  readonly fileType: BlogFileType;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** 博主信息视图 */
export interface BlogProfileView {
  readonly id: number;
  readonly nickname: string;
  readonly bio: string | null;
  readonly avatarUrl: string | null;
  readonly socialLinks: Record<string, string> | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** 仪表盘统计视图 */
export interface BlogDashboardView {
  readonly totalPosts: number;
  readonly publishedPosts: number;
  readonly draftPosts: number;
  readonly totalCategories: number;
  readonly totalTags: number;
  readonly totalComments: number;
  readonly pendingComments: number;
  readonly totalLikes: number;
  readonly totalViews: number;
}

// ─── Input 类型 ───

export interface CreateBlogPostInput {
  readonly title: string;
  readonly slug: string;
  readonly excerpt?: string;
  readonly content: string;
  readonly renderedContent?: string;
  readonly coverImage?: string;
  readonly status?: BlogPostStatus;
  readonly categoryId?: number;
  readonly tagIds?: number[];
  readonly isPinned?: boolean;
  readonly publishedAt?: Date;
}

/**
 * 更新文章输入
 * - 字段省略或 undefined 表示不修改该字段
 * - 显式传 null 表示清空该字段（仅对 categoryId / publishedAt / excerpt / coverImage 有效）
 */
export interface UpdateBlogPostInput {
  readonly title?: string;
  readonly slug?: string;
  readonly excerpt?: string | null;
  readonly content?: string;
  readonly renderedContent?: string;
  readonly coverImage?: string | null;
  readonly status?: BlogPostStatus;
  readonly categoryId?: number | null;
  readonly tagIds?: number[];
  readonly isPinned?: boolean;
  readonly publishedAt?: Date | null;
}

export interface CreateBlogCategoryInput {
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
  readonly parentId?: number;
  readonly sortOrder?: number;
}

/**
 * 更新分类输入
 * - 字段省略或 undefined 表示不修改该字段
 * - 显式传 null 表示清空该字段（仅对 description / parentId 有效）
 */
export interface UpdateBlogCategoryInput {
  readonly name?: string;
  readonly slug?: string;
  readonly description?: string | null;
  readonly parentId?: number | null;
  readonly sortOrder?: number;
}

export interface CreateBlogTagInput {
  readonly name: string;
  readonly slug: string;
}

/**
 * 更新标签输入
 * - 字段省略或 undefined 表示不修改该字段
 */
export interface UpdateBlogTagInput {
  readonly name?: string;
  readonly slug?: string;
}

export interface CreateBlogCommentInput {
  readonly postId: number;
  readonly parentId?: number;
  readonly replyToId?: number;
  readonly authorName: string;
  readonly authorEmail: string;
  readonly authorUrl?: string;
  readonly content: string;
}

export interface UpdateBlogCommentStatusInput {
  readonly id: number;
  readonly status: BlogCommentStatus;
}

export interface BatchUpdateBlogCommentStatusInput {
  readonly ids: number[];
  readonly status: BlogCommentStatus;
}

export interface UploadBlogFileInput {
  readonly originalName: string;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly storedName: string;
  readonly fileType: BlogFileType;
}

/**
 * 更新博主信息输入
 * - 字段省略或 undefined 表示不修改该字段
 * - 显式传 null 表示清空该字段（仅对 bio / avatarUrl / socialLinks 有效）
 */
export interface UpdateBlogProfileInput {
  readonly nickname?: string;
  readonly bio?: string | null;
  readonly avatarUrl?: string | null;
  readonly socialLinks?: Record<string, string> | null;
}
