import { Injectable } from '@nestjs/common';
import { CapabilityAnchorProvider } from '@src/infrastructure/capability/capability.decorators';

export const IDENTITY_AUTHENTICATION_CAPABILITY_ID = 'identity.authentication' as const;

// `identity.account` is owned by the account business module; auth cannot import from
// another business module, so this ID is kept as a literal. See docs/dependency-rules.
@Injectable()
@CapabilityAnchorProvider({
  capabilityId: IDENTITY_AUTHENTICATION_CAPABILITY_ID,
  mode: 'always-on',
  decisionRef: 'docs/capabilities/current.md',
  requires: ['identity.account'],
})
export class IdentityAuthenticationCapabilityAnchor {}
