import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { MagicItemCraftTaskView } from '../magic-item-craft.types';
import { MagicItemCraftTaskEntity } from '../magic-item-craft-task.entity';

@Injectable()
export class MagicItemCraftQueryService {
  constructor(
    @InjectRepository(MagicItemCraftTaskEntity)
    private readonly magicItemCraftTaskRepo: Repository<MagicItemCraftTaskEntity>,
  ) {}

  async findById(id: string): Promise<MagicItemCraftTaskView | null> {
    const entity = await this.magicItemCraftTaskRepo.findOne({ where: { id } });
    if (!entity) return null;
    return this.toView(entity);
  }

  async findByTraceId(traceId: string): Promise<MagicItemCraftTaskView | null> {
    const entity = await this.magicItemCraftTaskRepo.findOne({ where: { traceId } });
    if (!entity) return null;
    return this.toView(entity);
  }

  private toView(entity: MagicItemCraftTaskEntity): MagicItemCraftTaskView {
    return {
      id: entity.id,
      traceId: entity.traceId,
      itemName: entity.itemName,
      itemType: entity.itemType,
      materialLevel: entity.materialLevel,
      requestNote: entity.requestNote,
      status: entity.status,
      qualityLevel: entity.qualityLevel,
      resultDescription: entity.resultDescription,
      failureReason: entity.failureReason,
      craftLog: entity.craftLog,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
