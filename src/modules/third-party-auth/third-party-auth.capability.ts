// src/modules/third-party-auth/third-party-auth.capability.ts
import { Injectable } from '@nestjs/common';
import { CapabilityAnchorProvider } from '@src/infrastructure/capability/capability.decorators';

export const IDENTITY_EXTERNAL_ACCOUNT_CAPABILITY_ID = 'identity.external-account' as const;

// `identity.account` is owned by the account business module; third-party-auth cannot import
// from another business module, so this ID is kept as a literal. See docs/dependency-rules.
@Injectable()
@CapabilityAnchorProvider({
  capabilityId: IDENTITY_EXTERNAL_ACCOUNT_CAPABILITY_ID,
  mode: 'switchable',
  decisionRef: 'docs/capabilities/current.md',
  requires: ['identity.account'],
})
export class IdentityExternalAccountCapabilityAnchor {}
