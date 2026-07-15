import { Module } from '@nestjs/common';
import { DirectReferenceProfileClient } from '@src/infrastructure/capability/reference-profile.client';
import { REFERENCE_PROFILE_CLIENT } from '@src/usecases/common/ports/reference-profile-client.contract';
import { ReferenceProfileCapabilityAnchor } from './reference-profile.capability';
import { REFERENCE_PROFILE_LIST_HANDLER } from './reference-profile-list-by-group-keys.contract';
import { ReferenceProfileListByGroupKeysHandler } from './reference-profile-list-by-group-keys.handler';

@Module({
  providers: [
    ReferenceProfileCapabilityAnchor,
    ReferenceProfileListByGroupKeysHandler,
    {
      provide: REFERENCE_PROFILE_LIST_HANDLER,
      useExisting: ReferenceProfileListByGroupKeysHandler,
    },
    DirectReferenceProfileClient,
    {
      provide: REFERENCE_PROFILE_CLIENT,
      useExisting: DirectReferenceProfileClient,
    },
  ],
  exports: [REFERENCE_PROFILE_CLIENT],
})
export class ReferenceCapabilityModule {}
