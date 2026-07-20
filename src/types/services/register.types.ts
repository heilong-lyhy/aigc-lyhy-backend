// src/types/services/register.types.ts

/**
 * 注册类型枚举
 * 仅作为注册 bounded context 的领域 enum，因 GraphQL enum.registry 与
 * register.input DTO 需要运行时值引用而保留在 L1（type.rules.md §3.1 例外）。
 */
export enum RegisterTypeEnum {
  /** 工作人员 */
  STAFF = 'STAFF',
  /** 注册用户 */
  REGISTRANT = 'REGISTRANT',
}
