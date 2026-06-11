// src/modules/third-party-auth/third-party-auth.view-mapper.ts
// Entity → View 映射纯函数，service 与 query.service 共用

import type { ThirdPartyAuthView } from '@app-types/models/third-party-auth.types';
import type { ThirdPartyAuthEntity } from './third-party-auth.entity';

export function mapThirdPartyAuthToView(record: ThirdPartyAuthEntity): ThirdPartyAuthView {
  return {
    id: record.id,
    accountId: record.accountId,
    provider: record.provider,
    providerUserId: record.providerUserId,
    unionId: record.unionId ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
