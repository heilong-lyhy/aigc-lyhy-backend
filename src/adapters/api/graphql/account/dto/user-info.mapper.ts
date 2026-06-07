// src/adapters/api/graphql/account/dto/user-info.mapper.ts
// Adapter mapper: UserInfoView -> UserInfoDTO / BasicUserInfoDTO
// Pure function, no side effects

import type { UserInfoView } from '@app-types/models/auth.types';
import type { GeographicInfo } from '@app-types/models/user-info.types';
import { BasicUserInfoDTO } from './basic-user-info.dto';
import { UserInfoDTO } from './user-info.dto';

/**
 * Serialize GeographicInfo to a display string
 */
export function serializeGeographic(geographic: GeographicInfo | null): string | null {
  if (!geographic) return null;
  const parts: string[] = [];
  if (geographic.province) parts.push(geographic.province);
  if (geographic.city) parts.push(geographic.city);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Map UserInfoView to full UserInfoDTO
 */
export function mapUserInfoViewToDTO(view: UserInfoView): UserInfoDTO {
  return {
    id: view.accountId,
    accountId: view.accountId,
    nickname: view.nickname,
    gender: view.gender,
    birthDate: view.birthDate,
    avatarUrl: view.avatarUrl,
    email: view.email,
    signature: view.signature,
    accessGroup: view.accessGroup,
    address: view.address,
    phone: view.phone,
    tags: view.tags,
    geographic: serializeGeographic(view.geographic),
    notifyCount: view.notifyCount,
    unreadCount: view.unreadCount,
    userState: view.userState,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
  };
}

/**
 * Map UserInfoView to basic BasicUserInfoDTO
 */
export function mapUserInfoViewToBasicDTO(view: UserInfoView): BasicUserInfoDTO {
  return {
    id: view.accountId,
    accountId: view.accountId,
    nickname: view.nickname,
    gender: view.gender,
    avatarUrl: view.avatarUrl,
    phone: view.phone,
  };
}
