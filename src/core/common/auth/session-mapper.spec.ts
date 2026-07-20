// src/core/common/auth/session-mapper.spec.ts
import { describe, expect, it } from '@jest/globals';

import type { JwtPayload } from '@app-types/jwt.types';

import { mapJwtToUsecaseSession } from './session-mapper';

describe('mapJwtToUsecaseSession', () => {
  it('映射 sub 到 accountId，并保留 accessGroup 大写形式', () => {
    const jwt: JwtPayload = {
      sub: 42,
      username: 'alice',
      email: null,
      accessGroup: ['staff'],
    };

    const session = mapJwtToUsecaseSession(jwt);

    expect(session.accountId).toBe(42);
    expect(session.roles).toEqual(['STAFF']);
  });

  it('过滤空字符串与空值，并去重', () => {
    const jwt: JwtPayload = {
      sub: 1,
      username: 'bob',
      email: null,
      accessGroup: ['staff', 'staff', '  ', '', 'admin'],
    };

    const session = mapJwtToUsecaseSession(jwt);

    expect(session.roles).toEqual(['STAFF', 'ADMIN']);
  });

  it('accessGroup 为非数组时返回空角色列表', () => {
    const jwt = {
      sub: 1,
      username: 'x',
      email: null,
      accessGroup: 'staff' as unknown as string[],
    };

    const session = mapJwtToUsecaseSession(jwt);

    expect(session.roles).toEqual([]);
  });
});
