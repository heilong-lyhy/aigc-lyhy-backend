import { Injectable } from '@nestjs/common';
import { DomainError, MAGIC_ITEM_CRAFT_ERROR } from '@core/common/errors/domain-error';
import { normalizeRequiredText } from '@core/common/input-normalize/input-normalize.policy';
import type { MagicItemCraftTaskView } from '@modules/magic-item-craft/magic-item-craft.types';
import { MagicItemCraftQueryService } from '@modules/magic-item-craft/queries/magic-item-craft.query.service';

export interface GetMagicItemCraftTaskInput {
  readonly id: string;
}

@Injectable()
export class GetMagicItemCraftTaskUsecase {
  constructor(private readonly magicItemCraftQueryService: MagicItemCraftQueryService) {}

  async execute(input: GetMagicItemCraftTaskInput): Promise<MagicItemCraftTaskView> {
    const normalizedId = normalizeRequiredText(input.id, { fieldName: 'id' });
    const view = await this.magicItemCraftQueryService.findById(normalizedId);
    if (!view) {
      throw new DomainError(
        MAGIC_ITEM_CRAFT_ERROR.TASK_NOT_FOUND,
        `Magic item craft task with id ${normalizedId} not found`,
      );
    }
    return view;
  }
}
