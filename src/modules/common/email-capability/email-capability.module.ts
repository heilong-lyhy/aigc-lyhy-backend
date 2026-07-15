// src/modules/common/email-capability/email-capability.module.ts
import { Module } from '@nestjs/common';
import {
  NotificationEmailCapabilityAnchor,
  RuntimeEmailDeliveryCapabilityAnchor,
} from './email-capability.providers';

@Module({
  providers: [NotificationEmailCapabilityAnchor, RuntimeEmailDeliveryCapabilityAnchor],
  exports: [NotificationEmailCapabilityAnchor, RuntimeEmailDeliveryCapabilityAnchor],
})
export class EmailCapabilityModule {}
