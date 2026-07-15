import { Module } from '@nestjs/common';
import { ReferenceProfileCapabilityAnchor } from './reference-profile.capability';
import { ReferenceProfileListByGroupKeysHandler } from './reference-profile-list-by-group-keys.handler';

@Module({
  providers: [
    ReferenceProfileCapabilityAnchor,
    ReferenceProfileListByGroupKeysHandler,
  ],
  exports: [
    ReferenceProfileCapabilityAnchor,
    ReferenceProfileListByGroupKeysHandler,
  ],
})
export class ReferenceCapabilityModule {}
