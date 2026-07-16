// src/adapters/api/graphql/guards/optional-jwt-auth.guard.spec.ts

import { UnauthorizedException } from '@nestjs/common';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('OptionalJwtAuthGuard', () => {
  let guard: OptionalJwtAuthGuard;

  beforeEach(() => {
    guard = new OptionalJwtAuthGuard();
  });

  describe('handleRequest', () => {
    it('无 token 时应放行返回 null', () => {
      // Passport 无 token 时: err=null, user=false, info=null
      const result = guard.handleRequest(null, false, null);
      expect(result).toBeNull();
    });

    it('有效 token 时应返回用户信息', () => {
      const user = { id: 1, accountId: 'acc-1', role: 'ADMIN' };
      const result = guard.handleRequest(null, user, null);
      expect(result).toBe(user);
    });

    it('err 存在时应抛出错误', () => {
      const err = new Error('认证服务错误');
      expect(() => guard.handleRequest(err, false, null)).toThrow(err);
    });

    it('info 为 Error 实例时应抛出', () => {
      const info = new Error('jwt malformed');
      expect(() => guard.handleRequest(null, false, info)).toThrow(info);
    });

    it('info.name 为 TokenExpiredError 时应抛出 UnauthorizedException', () => {
      const info = { name: 'TokenExpiredError', message: 'jwt expired', expiredAt: Date.now() };
      expect(() => guard.handleRequest(null, false, info)).toThrow(UnauthorizedException);
      try {
        guard.handleRequest(null, false, info);
      } catch (e) {
        expect((e as UnauthorizedException).message).toContain('TokenExpiredError');
      }
    });

    it('info.name 为 JsonWebTokenError 时应抛出 UnauthorizedException', () => {
      const info = { name: 'JsonWebTokenError', message: 'jwt malformed' };
      expect(() => guard.handleRequest(null, false, info)).toThrow(UnauthorizedException);
    });

    it('info.name 为 NotBeforeError 时应抛出 UnauthorizedException', () => {
      const info = { name: 'NotBeforeError', message: 'jwt not active' };
      expect(() => guard.handleRequest(null, false, info)).toThrow(UnauthorizedException);
    });

    it('info.name 为其他值时不应抛出（放行）', () => {
      const info = { name: 'SomeOtherError' };
      const result = guard.handleRequest(null, false, info);
      expect(result).toBeNull();
    });

    it('info 为非对象原始值时不应抛出', () => {
      const result1 = guard.handleRequest(null, false, 'string info');
      expect(result1).toBeNull();

      const result2 = guard.handleRequest(null, false, 42);
      expect(result2).toBeNull();

      const result3 = guard.handleRequest(null, false, null);
      expect(result3).toBeNull();
    });

    it('有效 token 但 info 也有值时不应误抛出', () => {
      // 正常认证成功时 info 可能不为 null（某些 Passport 策略行为）
      const user = { id: 1, accountId: 'acc-1', role: 'USER' };
      // info 不是 Error 且 name 不是已知 JWT 错误
      const result = guard.handleRequest(null, user, { name: 'SuccessInfo' });
      expect(result).toBe(user);
    });
  });
});
