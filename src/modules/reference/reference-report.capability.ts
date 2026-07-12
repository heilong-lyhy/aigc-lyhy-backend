import { Injectable } from '@nestjs/common';
import { CapabilityAnchorProvider } from '@src/infrastructure/capability/capability.decorators';
import { REFERENCE_REPORT_CAPABILITY_ID } from '@app-types/reference/reference-report.types';

@Injectable()
@CapabilityAnchorProvider({
  capabilityId: REFERENCE_REPORT_CAPABILITY_ID,
  mode: 'always-on',
  decisionRef: 'docs/capabilities/current.md',
  requires: [],
})
export class ReferenceReportCapabilityAnchor {}
