import { Injectable } from '@nestjs/common';
import { CapabilityAnchorProvider } from '@src/infrastructure/capability/capability.decorators';
import { AI_CAPABILITY_ID, AI_EXECUTION_CAPABILITY_ID } from './ai-capability.constants';

@Injectable()
@CapabilityAnchorProvider({
  capabilityId: AI_CAPABILITY_ID,
  mode: 'switchable',
  decisionRef: 'docs/capabilities/current.md',
  requires: [],
})
export class AiCapabilityAnchor {}

// `runtime.async-task` is owned by the async-task-record business module; `common/*`
// cannot import from business modules, so this ID is kept as a literal. See docs/dependency-rules.
@Injectable()
@CapabilityAnchorProvider({
  capabilityId: AI_EXECUTION_CAPABILITY_ID,
  mode: 'switchable',
  decisionRef: 'docs/capabilities/current.md',
  requires: ['runtime.async-task'],
})
export class AiExecutionCapabilityAnchor {}
