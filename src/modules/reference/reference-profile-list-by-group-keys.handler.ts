import type { CapabilityResult } from '@app-types/common/capability.types';
import {
  type ReferenceProfileListByGroupKeysInput,
  type ReferenceProfileSummary,
} from '@app-types/reference/reference-profile.types';
import { Injectable } from '@nestjs/common';
import { normalizeReferenceGroupKeysInput } from './reference.input.normalize';
import type { ReferenceProfileListHandlerPort } from './reference-profile-list-by-group-keys.contract';

const REFERENCE_PROFILES: readonly ReferenceProfileSummary[] = [
  { profileKey: 'profile-alpha-1', groupKey: 'alpha', displayName: 'Alpha One' },
  { profileKey: 'profile-alpha-2', groupKey: 'alpha', displayName: 'Alpha Two' },
  { profileKey: 'profile-beta-1', groupKey: 'beta', displayName: 'Beta One' },
];

@Injectable()
export class ReferenceProfileListByGroupKeysHandler implements ReferenceProfileListHandlerPort {
  listByGroupKeys(
    input: ReferenceProfileListByGroupKeysInput,
  ): Promise<CapabilityResult<readonly ReferenceProfileSummary[]>> {
    const requestedGroupKeys = normalizeReferenceGroupKeysInput(input.groupKeys);
    const profiles = REFERENCE_PROFILES.filter((profile) =>
      requestedGroupKeys.includes(profile.groupKey),
    );
    return Promise.resolve({ ok: true, value: profiles });
  }
}
