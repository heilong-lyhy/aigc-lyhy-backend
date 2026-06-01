import { Injectable } from '@nestjs/common';
import type {
  QueueMagicItemCraftTaskInput,
  QueueMagicItemCraftTaskResult,
} from '@modules/magic-item-craft/magic-item-craft.types';
import { MagicItemCraftService } from '@modules/magic-item-craft/magic-item-craft.service';

@Injectable()
export class QueueMagicItemCraftUsecase {
  constructor(private readonly magicItemCraftService: MagicItemCraftService) {}

  async execute(input: QueueMagicItemCraftTaskInput): Promise<QueueMagicItemCraftTaskResult> {
    const now = new Date();
    return await this.magicItemCraftService.enqueueTask(input, now);
  }
}
