import { Injectable } from '@nestjs/common';
import { ConsumeMagicItemCraftUsecase } from '@src/usecases/magic-item-craft/consume-magic-item-craft.usecase';
import {
  type MagicItemCraftJob,
  type MagicItemCraftResult,
  mapMagicItemCraftJobToCompleteInput,
  mapMagicItemCraftJobToFailInput,
  mapMagicItemCraftJobToProcessInput,
  mapMissingMagicItemCraftJobToFailInput,
} from './magic-item-craft-job.mapper';

@Injectable()
export class MagicItemCraftJobHandler {
  constructor(private readonly consumeMagicItemCraftUsecase: ConsumeMagicItemCraftUsecase) {}

  async process(input: { readonly job: MagicItemCraftJob }): Promise<MagicItemCraftResult> {
    return await this.consumeMagicItemCraftUsecase.process(
      mapMagicItemCraftJobToProcessInput({ job: input.job }),
    );
  }

  async onCompleted(input: { readonly job: MagicItemCraftJob }): Promise<void> {
    await this.consumeMagicItemCraftUsecase.complete(
      mapMagicItemCraftJobToCompleteInput({ job: input.job }),
    );
  }

  async onFailed(input: {
    readonly job: MagicItemCraftJob | undefined;
    readonly error: Error;
  }): Promise<void> {
    if (!input.job) {
      await this.consumeMagicItemCraftUsecase.fail(
        mapMissingMagicItemCraftJobToFailInput({ error: input.error }),
      );
      return;
    }
    await this.consumeMagicItemCraftUsecase.fail(
      mapMagicItemCraftJobToFailInput({
        job: input.job,
        error: input.error,
      }),
    );
  }
}
