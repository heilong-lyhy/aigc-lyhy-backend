import { Inject, Injectable } from '@nestjs/common';
import { RUNTIME_EMAIL_DELIVERY_CAPABILITY_ID } from '@src/modules/common/email-capability/email-capability.constants';
import {
  CAPABILITY_STATE_READER,
  type CapabilityStateReader,
} from '@src/modules/common/capability-state-reader.contract';

@Injectable()
export class EmailWorkerActivationUsecase {
  constructor(
    @Inject(CAPABILITY_STATE_READER)
    private readonly capabilityStateReader: CapabilityStateReader,
  ) {}

  shouldRun(): boolean {
    return (
      this.capabilityStateReader.getState(RUNTIME_EMAIL_DELIVERY_CAPABILITY_ID).effectiveState ===
      'enabled'
    );
  }
}
