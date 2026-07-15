import type { CapabilityOperationHandler } from '@app-types/common/capability.types';
import type {
  ReferenceProfileListByGroupKeysInput,
  ReferenceProfileSummary,
} from '@app-types/reference/reference-profile.types';

export const REFERENCE_PROFILE_LIST_HANDLER = Symbol('REFERENCE_PROFILE_LIST_HANDLER');

export type ReferenceProfileListHandlerPort = CapabilityOperationHandler<
  ReferenceProfileListByGroupKeysInput,
  readonly ReferenceProfileSummary[]
>;
