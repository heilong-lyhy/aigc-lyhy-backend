// src/types/common/capability-id.types.ts
// 跨 bounded context 共享的 Capability ID 常量
// 当 Capability ID 需被多个 bounded context 引用（包括 common 层），常量定义于此
// 业务域专属的 Capability ID 仍由各自 capability anchor 文件定义

export const RUNTIME_ASYNC_TASK_CAPABILITY_ID = 'runtime.async-task' as const;

/**
 * identity.account 能力 ID
 * 由 account bounded context 拥有，但被 auth / third-party-auth 等多个 bounded context
 * 作为依赖引用，因此常量上收到 L1（type.rules.md §2 L1）。
 */
export const IDENTITY_ACCOUNT_CAPABILITY_ID = 'identity.account' as const;
