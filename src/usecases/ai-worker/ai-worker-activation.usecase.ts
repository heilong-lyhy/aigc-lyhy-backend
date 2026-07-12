import { Inject, Injectable } from '@nestjs/common';
import { AI_EXECUTION_CAPABILITY_ID } from '@src/modules/common/ai-capability/ai-capability.constants';
import {
  CAPABILITY_STATE_READER,
  type CapabilityStateReader,
} from '@src/modules/common/capability-state-reader.contract';

@Injectable()
export class AiWorkerActivationUsecase {
  constructor(
    @Inject(CAPABILITY_STATE_READER)
    private readonly capabilityStateReader: CapabilityStateReader,
  ) {}

  shouldRun(): boolean {
    return (
      this.capabilityStateReader.getState(AI_EXECUTION_CAPABILITY_ID).effectiveState === 'enabled'
    );
  }
}
