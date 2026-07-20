import { Injectable } from '@nestjs/common';
import { RUNTIME_ASYNC_TASK_CAPABILITY_ID } from '@app-types/common/capability-id.types';
export { RUNTIME_ASYNC_TASK_CAPABILITY_ID };
import { CapabilityAnchorProvider } from '@src/infrastructure/capability/capability.decorators';

@Injectable()
@CapabilityAnchorProvider({
  capabilityId: RUNTIME_ASYNC_TASK_CAPABILITY_ID,
  mode: 'switchable',
  decisionRef: 'docs/capabilities/current.md',
  requires: [],
})
export class RuntimeAsyncTaskCapabilityAnchor {}
