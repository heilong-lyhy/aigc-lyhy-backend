import { Injectable } from '@nestjs/common';
import { DomainError } from '@core/common/errors/domain-error';
import type { MagicItemCraftTaskView } from '@modules/magic-item-craft/magic-item-craft.types';
import { MagicItemCraftQueryService } from '@modules/magic-item-craft/queries/magic-item-craft.query.service';

@Injectable()
export class GetMagicItemCraftTaskUsecase {
  constructor(private readonly magicItemCraftQueryService: MagicItemCraftQueryService) {}

  async execute(id: string): Promise<MagicItemCraftTaskView> {
    const view = await this.magicItemCraftQueryService.findById(id);
    if (!view) {
      throw new DomainError('RESOURCE_NOT_FOUND', `Magic item craft task with id ${id} not found`);
    }
    return view;
  }
}
