import { Inject, Injectable } from '@nestjs/common';
import { AI_WORKFLOW_CAPABILITY_ID } from '@src/modules/ai-workflow-context/ai-workflow.capability';
import {
  CAPABILITY_STATE_READER,
  type CapabilityStateReader,
} from '@src/modules/common/capability-state-reader.contract';

@Injectable()
export class AiWorkflowWorkerActivationUsecase {
  constructor(
    @Inject(CAPABILITY_STATE_READER)
    private readonly capabilityStateReader: CapabilityStateReader,
  ) {}

  shouldRun(): boolean {
    return (
      this.capabilityStateReader.getState(AI_WORKFLOW_CAPABILITY_ID).effectiveState === 'enabled'
    );
  }
}
