import { Injectable } from '@nestjs/common';
import { DomainError } from '@core/common/errors/domain-error';
import type { MagicItemCraftTaskView } from '@modules/magic-item-craft/magic-item-craft.types';
import { MagicItemCraftService } from '@modules/magic-item-craft/magic-item-craft.service';

@Injectable()
export class GetMagicItemCraftTaskUsecase {
  constructor(private readonly magicItemCraftService: MagicItemCraftService) {}

  async execute(id: string): Promise<MagicItemCraftTaskView> {
    const entity = await this.magicItemCraftService.findById(id);
    if (!entity) {
      throw new DomainError('RESOURCE_NOT_FOUND', `Magic item craft task with id ${id} not found`);
    }
    return this.magicItemCraftService.toView(entity);
  }
}
