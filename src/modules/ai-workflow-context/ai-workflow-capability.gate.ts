import { AI_EXECUTION_CAPABILITY_ID } from '@src/modules/common/ai-capability/ai-capability.constants';
import type { CapabilityStateReader } from '@src/modules/common/capability-state-reader.contract';
import { AI_WORKFLOW_CAPABILITY_ID } from './ai-workflow.capability';

const AI_WORKFLOW_DRAINABLE_ROOT_BLOCKERS = [AI_EXECUTION_CAPABILITY_ID] as const;

export function requireAiWorkflowEnabled(reader: CapabilityStateReader): void {
  reader.requireEnabled(AI_WORKFLOW_CAPABILITY_ID);
}

/**
 * Terminal reconciliation may use already-owned workflow facts when AI execution alone is disabled.
 * Explicit workflow/parent disablement and loss of Async Task remain non-drainable.
 */
export function requireAiWorkflowTerminalDrain(reader: CapabilityStateReader): void {
  const state = reader.getState(AI_WORKFLOW_CAPABILITY_ID);
  if (state.effectiveState === 'enabled') return;
  if (
    state.effectiveState === 'blocked' &&
    state.configuredState === 'enabled' &&
    state.rootBlockers.length > 0 &&
    state.rootBlockers.every((blocker) =>
      AI_WORKFLOW_DRAINABLE_ROOT_BLOCKERS.includes(
        blocker.capabilityId as (typeof AI_WORKFLOW_DRAINABLE_ROOT_BLOCKERS)[number],
      ),
    )
  ) {
    return;
  }
  reader.requireEnabled(AI_WORKFLOW_CAPABILITY_ID);
}
