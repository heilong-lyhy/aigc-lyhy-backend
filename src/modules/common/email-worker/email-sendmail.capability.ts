// src/modules/common/email-worker/email-sendmail.capability.ts
import { Injectable } from '@nestjs/common';
import {
  CapabilityAnchorProvider,
  CapabilityRuntimeContributionProvider,
} from '@src/infrastructure/capability/capability.decorators';
import { NOTIFICATION_EMAIL_SENDMAIL_CAPABILITY_ID } from '../email-capability/email-capability.constants';

@Injectable()
@CapabilityAnchorProvider({
  capabilityId: NOTIFICATION_EMAIL_SENDMAIL_CAPABILITY_ID,
  mode: 'switchable',
  decisionRef: 'docs/capabilities/current.md',
  // notification.email 是隐式父级（dotted prefix），不需要在 requires 中重复
  requires: [],
})
@CapabilityRuntimeContributionProvider({
  capabilityId: NOTIFICATION_EMAIL_SENDMAIL_CAPABILITY_ID,
  // 父级依赖已通过 Anchor 隐式前置保证，runtimeDependencies 不重复声明
  runtimeDependencies: [],
  queueResources: [],
})
export class EmailSendmailCapabilityBinding {}
