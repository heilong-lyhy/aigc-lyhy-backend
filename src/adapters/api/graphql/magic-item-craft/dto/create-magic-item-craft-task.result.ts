import { Field, ObjectType } from '@nestjs/graphql';
import { MagicItemCraftTaskStatus } from '@app-types/models/magic-item-craft.types';

@ObjectType()
export class CreateMagicItemCraftTaskResult {
  @Field(() => String, { description: '任务ID' })
  id!: string;

  @Field(() => MagicItemCraftTaskStatus, { description: '任务状态' })
  status!: MagicItemCraftTaskStatus;

  @Field(() => String, { description: '道具名称' })
  itemName!: string;

  @Field(() => Date, { description: '创建时间' })
  createdAt!: Date;
}
