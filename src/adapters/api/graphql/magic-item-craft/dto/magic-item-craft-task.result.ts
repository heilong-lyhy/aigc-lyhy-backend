import { Field, ObjectType } from '@nestjs/graphql';
import {
  MagicItemCraftTaskQualityLevel,
  MagicItemCraftTaskStatus,
  MagicItemCraftTaskType,
} from '@src/modules/magic-item-craft/magic-item-craft.types';

@ObjectType()
export class MagicItemCraftTaskResult {
  @Field(() => String, { description: '任务ID' })
  id!: string;

  @Field(() => String, { description: '链路追踪ID' })
  traceId!: string;

  @Field(() => String, { description: '道具名称' })
  itemName!: string;

  @Field(() => MagicItemCraftTaskType, { description: '道具类型' })
  itemType!: MagicItemCraftTaskType;

  @Field(() => Number, { description: '材料等级' })
  materialLevel!: number;

  @Field(() => String, { nullable: true, description: '请求备注' })
  requestNote!: string | null;

  @Field(() => MagicItemCraftTaskStatus, { description: '任务状态' })
  status!: MagicItemCraftTaskStatus;

  @Field(() => MagicItemCraftTaskQualityLevel, { nullable: true, description: '品质等级' })
  qualityLevel!: MagicItemCraftTaskQualityLevel | null;

  @Field(() => String, { nullable: true, description: '结果描述' })
  resultDescription!: string | null;

  @Field(() => String, { nullable: true, description: '失败原因' })
  failureReason!: string | null;

  @Field(() => String, { nullable: true, description: '制作日志' })
  craftLog!: string | null;

  @Field(() => Date, { description: '创建时间' })
  createdAt!: Date;

  @Field(() => Date, { description: '更新时间' })
  updatedAt!: Date;
}
