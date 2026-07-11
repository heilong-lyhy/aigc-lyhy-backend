import { Module } from '@nestjs/common';
import { ReferenceProfileCapabilityAnchor } from './reference-profile.capability';
import { ReferenceReportCapabilityAnchor } from './reference-report.capability';
import { ReferenceProfileListByGroupKeysHandler } from './reference-profile-list-by-group-keys.handler';

@Module({
  providers: [
    ReferenceProfileCapabilityAnchor,
    ReferenceReportCapabilityAnchor,
    ReferenceProfileListByGroupKeysHandler,
  ],
  exports: [
    ReferenceProfileCapabilityAnchor,
    ReferenceReportCapabilityAnchor,
    ReferenceProfileListByGroupKeysHandler,
  ],
})
export class ReferenceCapabilityModule {}
