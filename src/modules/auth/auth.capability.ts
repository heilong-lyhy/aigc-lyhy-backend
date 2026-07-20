import { Injectable } from '@nestjs/common';
import { CapabilityAnchorProvider } from '@src/infrastructure/capability/capability.decorators';
import { IDENTITY_ACCOUNT_CAPABILITY_ID } from '@app-types/common/capability-id.types';

export const IDENTITY_AUTHENTICATION_CAPABILITY_ID = 'identity.authentication' as const;

@Injectable()
@CapabilityAnchorProvider({
  capabilityId: IDENTITY_AUTHENTICATION_CAPABILITY_ID,
  mode: 'always-on',
  decisionRef: 'docs/capabilities/current.md',
  requires: [IDENTITY_ACCOUNT_CAPABILITY_ID],
})
export class IdentityAuthenticationCapabilityAnchor {}
