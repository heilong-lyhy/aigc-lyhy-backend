// Capability 稳定跨域类型定义
// 仅包含被 infrastructure capability 框架和跨域 contract 引用的稳定类型
// 通用 CQRS/Session/Provider/Envelope 抽象已移除（见 capability.rules.md "no generic bus"）
// 无消费者的 HealthCheck/ProviderBinding/QueueBinding 类型已移除（无 real production behavior 消费）

export type CapabilityId = string;

export type CapabilityMode = 'always-on' | 'switchable';

export type CapabilityProcess = 'api' | 'worker';

export type CapabilityConfiguredState = 'enabled' | 'disabled';

export type CapabilityEffectiveState = 'not_installed' | 'disabled' | 'blocked' | 'enabled';

export type CapabilityHealthStatus = 'unknown' | 'healthy' | 'degraded' | 'unhealthy';

export interface CapabilityAnchor {
  readonly capabilityId: CapabilityId;
  readonly mode: CapabilityMode;
  readonly decisionRef: string;
  readonly requires: readonly CapabilityId[];
}

export interface CapabilityRuntimeDependency {
  readonly capabilityId: CapabilityId;
  readonly requirement: CapabilityRuntimeDependencyRequirement;
}

export type CapabilityRuntimeDependencyRequirement = 'required' | 'optional';

export interface CapabilityQueueResource {
  readonly queueName: string;
  readonly jobName: string;
}

export interface CapabilityRuntimeContribution {
  readonly capabilityId: CapabilityId;
  readonly runtimeDependencies: readonly CapabilityRuntimeDependency[];
  readonly queueResources: readonly CapabilityQueueResource[];
}

export interface CapabilityRootBlocker {
  readonly capabilityId: CapabilityId;
  readonly effectiveState: 'not_installed' | 'disabled';
}

export interface CapabilityStateSnapshot {
  readonly capabilityId: CapabilityId;
  readonly configuredState: CapabilityConfiguredState | null;
  readonly effectiveState: CapabilityEffectiveState;
  readonly health: CapabilityHealthStatus;
  readonly rootBlockers: readonly CapabilityRootBlocker[];
}

// Capability 操作结果包装——被 narrow-typed contract 使用
// code 字段使用 string 类型，避免与 src/core/common/errors/domain-error.ts 的 CapabilityErrorCode 重复定义
// （type.rules.md: 业务错误码单一真源在 src/core；src/types 禁止依赖 src/core）
export interface CapabilityError {
  readonly code: string;
  readonly message: string;
  readonly capabilityId?: CapabilityId;
  readonly operation?: string;
  readonly details?: unknown;
}

export type CapabilityResult<TResult> =
  | {
      readonly ok: true;
      readonly value: TResult;
    }
  | {
      readonly ok: false;
      readonly error: CapabilityError;
    };
