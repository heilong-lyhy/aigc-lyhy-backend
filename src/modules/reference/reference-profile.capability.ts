import { Injectable } from '@nestjs/common';
import { CapabilityAnchorProvider } from '@src/infrastructure/capability/capability.decorators';
import { REFERENCE_PROFILE_CAPABILITY_ID } from '@app-types/reference/reference-profile.types';

@Injectable()
@CapabilityAnchorProvider({
  capabilityId: REFERENCE_PROFILE_CAPABILITY_ID,
  mode: 'always-on',
  decisionRef: 'docs/capabilities/current.md',
  requires: [],
})
export class ReferenceProfileCapabilityAnchor {}
