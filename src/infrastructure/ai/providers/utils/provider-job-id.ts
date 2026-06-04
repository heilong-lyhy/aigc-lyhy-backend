// src/infrastructure/ai/providers/utils/provider-job-id.ts
// AI provider jobId 生成共享纯函数
// 用于 OpenAI 兼容 provider 基类和 LocalMockAiProvider 共用

import { createHash } from 'node:crypto';

/**
 * 基于 model + content 生成确定性 providerJobId
 * 格式: `{provider}:{sha256(model:content).slice(0,24)}`
 */
export function buildProviderJobId(input: {
  readonly provider: string;
  readonly model: string;
  readonly content: string;
}): string {
  const digest = createHash('sha256').update(`${input.model}:${input.content}`).digest('hex');
  return `${input.provider}:${digest.slice(0, 24)}`;
}
