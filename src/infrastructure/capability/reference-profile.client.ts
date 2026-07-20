import type { CapabilityResult } from '@app-types/common/capability.types';
import type {
  ReferenceProfileListByGroupKeysInput,
  ReferenceProfileSummary,
} from '@app-types/reference/reference-profile.types';
import { Inject, Injectable } from '@nestjs/common';
import {
  REFERENCE_PROFILE_LIST_HANDLER,
  type ReferenceProfileListHandlerPort,
} from '@src/modules/reference/reference-profile-list-by-group-keys.contract';
import type { ReferenceProfileClient } from '@src/usecases/common/ports/reference-profile-client.contract';

@Injectable()
export class DirectReferenceProfileClient implements ReferenceProfileClient {
  constructor(
    @Inject(REFERENCE_PROFILE_LIST_HANDLER)
    private readonly handler: ReferenceProfileListHandlerPort,
  ) {}

  listByGroupKeys(
    input: ReferenceProfileListByGroupKeysInput,
  ): Promise<CapabilityResult<readonly ReferenceProfileSummary[]>> {
    return this.handler.listByGroupKeys(input);
  }
}
