import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { trimText } from '@src/core/common/text/text.helper';
import { MagicItemCraftTaskType } from '@app-types/models/magic-item-craft.types';

@InputType()
export class CreateMagicItemCraftTaskInput {
  @Field(() => String, { description: '道具名称' })
  @Transform(({ value }: TransformFnParams) => trimText(value))
  @IsString({ message: '道具名称必须是字符串' })
  @IsNotEmpty({ message: '道具名称不能为空' })
  itemName!: string;

  @Field(() => MagicItemCraftTaskType, { description: '道具类型: WEAPON / ARMOR / TOOL / TOY' })
  @IsEnum(MagicItemCraftTaskType, { message: '道具类型必须是 WEAPON / ARMOR / TOOL / TOY 之一' })
  itemType!: MagicItemCraftTaskType;

  @Field(() => Int, { description: '材料等级 1-5' })
  @IsInt({ message: '材料等级必须是整数' })
  @Min(1, { message: '材料等级最小为 1' })
  @Max(5, { message: '材料等级最大为 5' })
  materialLevel!: number;

  @Field(() => String, { nullable: true, description: '请求备注' })
  @IsOptional()
  @Transform(({ value }: TransformFnParams) => trimText(value))
  @IsString({ message: '请求备注必须是字符串' })
  requestNote?: string;
}
