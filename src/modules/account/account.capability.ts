import { Injectable } from '@nestjs/common';
import { CapabilityAnchorProvider } from '@src/infrastructure/capability/capability.decorators';
import { IDENTITY_ACCOUNT_CAPABILITY_ID } from '@app-types/common/capability-id.types';

export { IDENTITY_ACCOUNT_CAPABILITY_ID };

@Injectable()
@CapabilityAnchorProvider({
  capabilityId: IDENTITY_ACCOUNT_CAPABILITY_ID,
  mode: 'always-on',
  decisionRef: 'docs/capabilities/current.md',
  requires: [],
})
export class IdentityAccountCapabilityAnchor {}
