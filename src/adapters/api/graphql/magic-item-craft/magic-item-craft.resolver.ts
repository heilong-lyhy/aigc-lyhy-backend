import { ValidateInput } from '@adapters/api/graphql/common/validate-input.decorator';
import { JwtPayload } from '@app-types/jwt.types';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { currentUser } from '@adapters/api/graphql/decorators/current-user.decorator';
import { qmWorkerEntry } from '@adapters/api/graphql/decorators/qm-worker-entry.decorator';
import { QueueMagicItemCraftUsecase } from '@src/usecases/magic-item-craft/queue-magic-item-craft.usecase';
import { GetMagicItemCraftTaskUsecase } from '@src/usecases/magic-item-craft/get-magic-item-craft-task.usecase';
import { CreateMagicItemCraftTaskInput } from './dto/create-magic-item-craft-task.input';
import { CreateMagicItemCraftTaskResult } from './dto/create-magic-item-craft-task.result';
import { MagicItemCraftTaskResult } from './dto/magic-item-craft-task.result';

@Resolver()
export class MagicItemCraftResolver {
  constructor(
    private readonly queueMagicItemCraftUsecase: QueueMagicItemCraftUsecase,
    private readonly getMagicItemCraftTaskUsecase: GetMagicItemCraftTaskUsecase,
  ) {}

  @qmWorkerEntry('MAGIC_ITEM_CRAFT_RELAXED')
  @Mutation(() => CreateMagicItemCraftTaskResult, { description: '提交魔法道具制作任务' })
  @ValidateInput()
  async createMagicItemCraftTask(
    @Args('input') input: CreateMagicItemCraftTaskInput,
    @currentUser() currentUser: JwtPayload | null,
  ): Promise<CreateMagicItemCraftTaskResult> {
    return await this.queueMagicItemCraftUsecase.execute({
      itemName: input.itemName,
      itemType: input.itemType,
      materialLevel: input.materialLevel,
      requestNote: input.requestNote,
      actorAccountId: currentUser?.sub ?? null,
      actorActiveRole: currentUser?.activeRole ?? null,
    });
  }

  @Query(() => MagicItemCraftTaskResult, { description: '查询魔法道具制作任务' })
  async magicItemCraftTask(@Args('id') id: string): Promise<MagicItemCraftTaskResult> {
    const task = await this.getMagicItemCraftTaskUsecase.execute(id);
    return {
      id: task.id,
      traceId: task.traceId,
      itemName: task.itemName,
      itemType: task.itemType,
      materialLevel: task.materialLevel,
      requestNote: task.requestNote,
      status: task.status,
      qualityLevel: task.qualityLevel,
      resultDescription: task.resultDescription,
      failureReason: task.failureReason,
      craftLog: task.craftLog,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}
