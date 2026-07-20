// src/core/common/auth/session-mapper.ts
import type { JwtPayload } from '@app-types/jwt.types';
import type { UsecaseSession } from '@app-types/auth/session.types';

/**
 * 从 JWT Payload 映射到 UsecaseSession 的辅助函数。
 *
 * 放置位置说明：
 * - `UsecaseSession` 是跨 bounded context 的稳定契约，归 L1（src/types/auth/session.types.ts）。
 * - 本函数包含 accessGroup 规范化（大写、去重、过滤）等运行时逻辑，按 type.rules.md §2
 *   L1 原则不得保留在 `src/types`，故 colocate 到 `src/core/common/auth/`。
 * - core 层 framework-free，仅依赖 L1 纯类型，符合分层依赖方向。
 *
 * 调用方：adapters 在 JwtAuthGuard 后构造 session，并把它传给 Usecase / QueryService。
 */
export function mapJwtToUsecaseSession(jwt: JwtPayload): UsecaseSession {
  return {
    accountId: jwt.sub,
    roles: normalizeAccessGroup(jwt.accessGroup),
  };
}

/**
 * 将 JWT `accessGroup` 规范化为用例层可直接使用的角色数组
 * - 统一转为大写字符串
 * - 过滤空值与空字符串
 * - 去重，避免重复角色影响后续判断与日志
 */
function normalizeAccessGroup(accessGroup: string[]): string[] {
  if (!Array.isArray(accessGroup)) return [];

  const normalized: string[] = [];
  for (const role of accessGroup) {
    if (role == null) continue;
    const name = String(role).trim();
    if (!name) continue;
    normalized.push(name.toUpperCase());
  }

  return Array.from(new Set(normalized));
}
