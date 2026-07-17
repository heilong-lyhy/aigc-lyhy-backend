import { Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_EMAIL_CAPABILITY_ID,
  RUNTIME_EMAIL_DELIVERY_CAPABILITY_ID,
} from '@src/modules/common/email-capability/email-capability.constants';
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
    // notification.email 是通知级邮件门控：禁用后 Worker 不应认领任务
    const notificationEnabled =
      this.capabilityStateReader.getState(NOTIFICATION_EMAIL_CAPABILITY_ID).effectiveState ===
      'enabled';
    // runtime.email-delivery 是投递基础设施门控：禁用后投递机制不可用
    const deliveryEnabled =
      this.capabilityStateReader.getState(RUNTIME_EMAIL_DELIVERY_CAPABILITY_ID).effectiveState ===
      'enabled';
    return notificationEnabled && deliveryEnabled;
  }
}
