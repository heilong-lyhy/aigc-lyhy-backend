// src/infrastructure/capability/capability.decorators.ts
import type {
  CapabilityAnchor,
  CapabilityRuntimeContribution,
} from '@app-types/common/capability.types';
import { DiscoveryService } from '@nestjs/core';

export const CAPABILITY_ANCHOR_DISCOVERABLE = DiscoveryService.createDecorator<CapabilityAnchor>();
export const CAPABILITY_RUNTIME_CONTRIBUTION_DISCOVERABLE =
  DiscoveryService.createDecorator<CapabilityRuntimeContribution>();

export const CAPABILITY_ANCHOR_METADATA_KEY = CAPABILITY_ANCHOR_DISCOVERABLE.KEY;
export const CAPABILITY_RUNTIME_CONTRIBUTION_METADATA_KEY =
  CAPABILITY_RUNTIME_CONTRIBUTION_DISCOVERABLE.KEY;

// eslint-disable-next-line @typescript-eslint/naming-convention
export function CapabilityAnchorProvider(anchor: CapabilityAnchor): ClassDecorator {
  return CAPABILITY_ANCHOR_DISCOVERABLE(anchor);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function CapabilityRuntimeContributionProvider(
  contribution: CapabilityRuntimeContribution,
): ClassDecorator {
  return CAPABILITY_RUNTIME_CONTRIBUTION_DISCOVERABLE(contribution);
}
