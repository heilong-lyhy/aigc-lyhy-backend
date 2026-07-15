import { Injectable } from '@nestjs/common';
import { CapabilityAnchorProvider } from '@src/infrastructure/capability/capability.decorators';
import {
  NOTIFICATION_EMAIL_CAPABILITY_ID,
  RUNTIME_EMAIL_DELIVERY_CAPABILITY_ID,
} from './email-capability.constants';

@Injectable()
@CapabilityAnchorProvider({
  capabilityId: NOTIFICATION_EMAIL_CAPABILITY_ID,
  mode: 'switchable',
  decisionRef: 'docs/capabilities/current.md',
  requires: [],
})
export class NotificationEmailCapabilityAnchor {}

@Injectable()
@CapabilityAnchorProvider({
  capabilityId: RUNTIME_EMAIL_DELIVERY_CAPABILITY_ID,
  mode: 'switchable',
  decisionRef: 'docs/capabilities/current.md',
  requires: [],
})
export class RuntimeEmailDeliveryCapabilityAnchor {}
