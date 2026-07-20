// src/modules/third-party-auth/third-party-auth.capability.ts
import { Injectable } from '@nestjs/common';
import { CapabilityAnchorProvider } from '@src/infrastructure/capability/capability.decorators';
import { IDENTITY_ACCOUNT_CAPABILITY_ID } from '@app-types/common/capability-id.types';

export const IDENTITY_EXTERNAL_ACCOUNT_CAPABILITY_ID = 'identity.external-account' as const;

@Injectable()
@CapabilityAnchorProvider({
  capabilityId: IDENTITY_EXTERNAL_ACCOUNT_CAPABILITY_ID,
  mode: 'switchable',
  decisionRef: 'docs/capabilities/current.md',
  requires: [IDENTITY_ACCOUNT_CAPABILITY_ID],
})
export class IdentityExternalAccountCapabilityAnchor {}
