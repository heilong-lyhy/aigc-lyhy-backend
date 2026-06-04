// src/modules/blog/contracts/avatar-generator.contract.ts
// Module-owned boundary contract：评论头像生成能力
// Blog 模块需要隔离可替换的头像生成实现，由 infrastructure 层提供具体实现

/** DI token for AvatarGenerator */
export const BLOG_AVATAR_GENERATOR_TOKEN = Symbol('AvatarGenerator');

export interface AvatarGenerator {
  /**
   * 根据邮箱生成头像 URL
   * @param email 评论者邮箱
   * @returns 头像 URL，生成失败时返回 null
   */
  generateAvatar(email: string): Promise<string | null>;
}
