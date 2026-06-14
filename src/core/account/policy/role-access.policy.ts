// 文件位置：src/core/account/policy/role-access.policy.ts
import { IdentityTypeEnum } from '@app-types/models/account.types';

export const roleHierarchy: Readonly<Record<IdentityTypeEnum, ReadonlyArray<IdentityTypeEnum>>> = {
  ADMIN: [IdentityTypeEnum.STAFF, IdentityTypeEnum.GUEST],
  STAFF: [IdentityTypeEnum.GUEST],
  GUEST: [],
  REGISTRANT: [],
};

const VALID_ROLES = new Set<string>(Object.values(IdentityTypeEnum));

export function normalizeAccessGroup(
  accessGroup?: ReadonlyArray<string | IdentityTypeEnum> | null,
  options?: { fallbackToRegistrant?: boolean },
): IdentityTypeEnum[] {
  const fallbackToRegistrant = options?.fallbackToRegistrant ?? false;
  const input = accessGroup ?? [];

  const normalized: IdentityTypeEnum[] = [];
  const seen = new Set<IdentityTypeEnum>();

  for (const role of input) {
    const name = String(role).toUpperCase();
    if (!VALID_ROLES.has(name)) continue;
    const typed = name as IdentityTypeEnum;
    if (!seen.has(typed)) {
      seen.add(typed);
      normalized.push(typed);
    }
  }

  if (normalized.length === 0 && fallbackToRegistrant) {
    return [IdentityTypeEnum.REGISTRANT];
  }

  return normalized;
}

export function expandRoles(roles: ReadonlyArray<string | IdentityTypeEnum>): IdentityTypeEnum[] {
  const normalized = roles
    .map((r) => String(r).toUpperCase())
    .filter((r): r is IdentityTypeEnum =>
      (Object.values(IdentityTypeEnum) as string[]).includes(r),
    );

  const result = new Set<IdentityTypeEnum>();
  const dfs = (role: IdentityTypeEnum) => {
    if (result.has(role)) return;
    result.add(role);
    (roleHierarchy[role] || []).forEach(dfs);
  };

  normalized.forEach((r) => dfs(r));
  return Array.from(result);
}

export function hasRole(
  roles: ReadonlyArray<string | IdentityTypeEnum>,
  target: IdentityTypeEnum,
): boolean {
  return expandRoles(roles).includes(target);
}
