import type {
  CapabilityOperationHandler as CapabilityOperationHandlerType,
  CapabilityQuery,
  CapabilityResult,
} from '@app-types/common/capability.types';
import { Injectable } from '@nestjs/common';
import {
  CapabilityOperationHandlerProvider,
  CapabilityAnchorProvider,
  CapabilityRuntimeContributionProvider,
} from '@src/infrastructure/capability/capability.decorators';

export const REFERENCE_PROFILE_CAPABILITY_ID = 'reference.profile';
export const REFERENCE_PROFILE_LIST_OPERATION = 'listByGroupKeys';
export const REFERENCE_PROFILE_CLIENT = Symbol('REFERENCE_PROFILE_CLIENT');

export interface ReferenceProfileSummary {
  readonly profileKey: string;
  readonly groupKey: string;
  readonly displayName: string;
}

export interface ReferenceProfileClient {
  listByGroupKeys(input: {
    readonly groupKeys: readonly string[];
  }): Promise<CapabilityResult<readonly ReferenceProfileSummary[]>>;
}

export interface ReferenceReportView {
  readonly groupCount: number;
  readonly totalProfiles: number;
  readonly items: readonly {
    readonly groupKey: string;
    readonly profileCount: number;
    readonly profileNames: readonly string[];
  }[];
}

@Injectable()
@CapabilityAnchorProvider({
  capabilityId: REFERENCE_PROFILE_CAPABILITY_ID,
  mode: 'switchable',
  decisionRef: 'docs/capabilities/reference-fixtures.md',
  requires: [],
})
@CapabilityRuntimeContributionProvider({
  capabilityId: REFERENCE_PROFILE_CAPABILITY_ID,
  runtimeDependencies: [],
  queueResources: [],
})
export class ReferenceProfileCapabilityAnchor {}

const REFERENCE_PROFILES: readonly ReferenceProfileSummary[] = [
  { profileKey: 'profile-alpha-1', groupKey: 'alpha', displayName: 'Alpha One' },
  { profileKey: 'profile-alpha-2', groupKey: 'alpha', displayName: 'Alpha Two' },
  { profileKey: 'profile-beta-1', groupKey: 'beta', displayName: 'Beta One' },
];

@Injectable()
@CapabilityOperationHandlerProvider({
  capabilityId: REFERENCE_PROFILE_CAPABILITY_ID,
  operation: REFERENCE_PROFILE_LIST_OPERATION,
  operationKind: 'query',
})
export class ReferenceProfileListHandler implements CapabilityOperationHandlerType<
  { readonly groupKeys: readonly string[] },
  readonly ReferenceProfileSummary[]
> {
  readonly capability = REFERENCE_PROFILE_CAPABILITY_ID;
  readonly operation = REFERENCE_PROFILE_LIST_OPERATION;
  readonly operationKind = 'query' as const;

  handle(
    envelope: CapabilityQuery<{ readonly groupKeys: readonly string[] }>,
  ): Promise<CapabilityResult<readonly ReferenceProfileSummary[]>> {
    const groupKeys = normalizeGroupKeys(envelope.payload.groupKeys);
    return Promise.resolve({
      ok: true,
      value: REFERENCE_PROFILES.filter((profile) => groupKeys.includes(profile.groupKey)),
    });
  }
}

@Injectable()
export class DirectReferenceProfileClient implements ReferenceProfileClient {
  constructor(private readonly handler: ReferenceProfileListHandler) {}

  async listByGroupKeys(input: {
    readonly groupKeys: readonly string[];
  }): Promise<CapabilityResult<readonly ReferenceProfileSummary[]>> {
    return await this.handler.handle({
      capability: this.handler.capability,
      operation: this.handler.operation,
      operationKind: this.handler.operationKind,
      context: {
        traceId: 'direct-call',
        requestId: 'direct-call',
        actor: { source: 'system' },
      },
      payload: input,
      createdAt: new Date(),
    });
  }
}

@Injectable()
export class BuildReferenceReportUsecase {
  constructor(private readonly profileClient: ReferenceProfileClient) {}

  async execute(input: {
    readonly groupKeys: readonly string[];
  }): Promise<CapabilityResult<ReferenceReportView>> {
    const groupKeys = normalizeGroupKeys(input.groupKeys);
    const result = await this.profileClient.listByGroupKeys({ groupKeys });
    if (!result.ok) return result;

    return {
      ok: true,
      value: {
        groupCount: groupKeys.length,
        totalProfiles: result.value.length,
        items: groupKeys.map((groupKey) => {
          const profiles = result.value.filter((profile) => profile.groupKey === groupKey);
          return {
            groupKey,
            profileCount: profiles.length,
            profileNames: profiles.map((profile) => profile.displayName),
          };
        }),
      },
    };
  }
}

export const REFERENCE_PROFILE_FIXTURE_PROVIDERS = [
  ReferenceProfileCapabilityAnchor,
  ReferenceProfileListHandler,
  DirectReferenceProfileClient,
  BuildReferenceReportUsecase,
  {
    provide: REFERENCE_PROFILE_CLIENT,
    useExisting: DirectReferenceProfileClient,
  },
] as const;

function normalizeGroupKeys(input: readonly string[]): readonly string[] {
  return [...new Set(input.map((item) => item.trim()).filter(Boolean))];
}
