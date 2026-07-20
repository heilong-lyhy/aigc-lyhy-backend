// src/types/auth/session.types.ts

/**
 * Usecase 层统一会话类型。
 *
 * 跨 bounded context（adapters / usecases / modules 共享）的稳定契约，归 L1
 * （type.rules.md §2 L1）。本文件只保留纯类型；含运行时逻辑的映射函数
 * `mapJwtToUsecaseSession` 位于 `src/core/common/auth/session-mapper.ts`。
 */
export interface UsecaseSession {
  /** 当前账户 ID */
  accountId: number;
  /**
   * 角色访问组（已规范化）
   * - 来源：JWT `accessGroup`
   * - 格式：全部转为大写字符串，去除空值与重复项
   * - 语义：与 GraphQL `@Roles()` 所使用的角色编码保持一致（如 "STAFF"）
   */
  roles: string[];
}
