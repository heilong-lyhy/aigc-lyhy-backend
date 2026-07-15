// src/infrastructure/graphql/filters/graphql-exception.filter.spec.ts

import {
  AUTH_ERROR,
  BLOG_ERROR,
  CAPABILITY_ERROR,
  DomainError,
  JWT_ERROR,
  PAGINATION_ERROR,
  PERMISSION_ERROR,
  THIRDPARTY_ERROR,
} from '@core/common/errors';
import {
  ArgumentsHost,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { GraphQLError } from 'graphql';
import { GqlAllExceptionsFilter } from './graphql-exception.filter';

// ─── Helpers ───

const makeGqlHost = (fieldName = 'testField'): ArgumentsHost =>
  ({
    getType: () => 'graphql',
    getArgs: () => [undefined, {}, {}, { fieldName }],
  }) as unknown as ArgumentsHost;

const makeConfig = (env: string) =>
  ({
    get: jest.fn().mockReturnValue(env),
  }) as unknown as ConfigService;

const asGqlError = (result: unknown): GraphQLError => result as GraphQLError;

// ─── DomainError 映射 ───

describe(GqlAllExceptionsFilter.name, () => {
  describe('DomainError 映射', () => {
    it('AUTH_ERROR → UNAUTHENTICATED / FORBIDDEN', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('production'));
      const host = makeGqlHost();

      const unauth = asGqlError(
        filter.catch(new DomainError(AUTH_ERROR.ACCOUNT_NOT_FOUND, 'not found'), host),
      );
      expect(unauth.extensions.code).toBe('UNAUTHENTICATED');

      const forbidden = asGqlError(
        filter.catch(new DomainError(AUTH_ERROR.ACCOUNT_BANNED, 'banned'), host),
      );
      expect(forbidden.extensions.code).toBe('FORBIDDEN');
    });

    it('JWT_ERROR → UNAUTHENTICATED (token errors)', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('production'));
      const host = makeGqlHost();

      const expired = asGqlError(
        filter.catch(new DomainError(JWT_ERROR.TOKEN_EXPIRED, 'expired'), host),
      );
      expect(expired.extensions.code).toBe('UNAUTHENTICATED');

      const invalid = asGqlError(
        filter.catch(new DomainError(JWT_ERROR.TOKEN_INVALID, 'invalid'), host),
      );
      expect(invalid.extensions.code).toBe('UNAUTHENTICATED');
    });

    it('PERMISSION_ERROR → FORBIDDEN', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('production'));
      const host = makeGqlHost();

      const err = asGqlError(
        filter.catch(new DomainError(PERMISSION_ERROR.INSUFFICIENT_PERMISSIONS, 'no perm'), host),
      );
      expect(err.extensions.code).toBe('FORBIDDEN');
    });

    it('BLOG_ERROR → 默认 BAD_USER_INPUT', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('production'));
      const host = makeGqlHost();

      const err = asGqlError(
        filter.catch(new DomainError(BLOG_ERROR.POST_NOT_FOUND, 'not found'), host),
      );
      expect(err.extensions.code).toBe('BAD_USER_INPUT');
      expect(err.extensions.errorCode).toBe(BLOG_ERROR.POST_NOT_FOUND);
    });

    it('CAPABILITY_ERROR.UNAVAILABLE → INTERNAL_SERVER_ERROR', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('production'));
      const host = makeGqlHost();

      const err = asGqlError(
        filter.catch(new DomainError(CAPABILITY_ERROR.UNAVAILABLE, 'unavail'), host),
      );
      expect(err.extensions.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('PAGINATION_ERROR → BAD_USER_INPUT / INTERNAL_SERVER_ERROR', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('production'));
      const host = makeGqlHost();

      const badInput = asGqlError(
        filter.catch(new DomainError(PAGINATION_ERROR.INVALID_PAGE_SIZE, 'bad size'), host),
      );
      expect(badInput.extensions.code).toBe('BAD_USER_INPUT');

      const dbErr = asGqlError(
        filter.catch(new DomainError(PAGINATION_ERROR.DB_QUERY_FAILED, 'db fail'), host),
      );
      expect(dbErr.extensions.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('THIRDPARTY_ERROR 认证类 → UNAUTHENTICATED', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('production'));
      const host = makeGqlHost();

      const err = asGqlError(
        filter.catch(new DomainError(THIRDPARTY_ERROR.CREDENTIAL_INVALID, 'bad cred'), host),
      );
      expect(err.extensions.code).toBe('UNAUTHENTICATED');
    });

    it('DomainError 应保留 errorCode 和 errorMessage', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('development'));
      const host = makeGqlHost();

      const err = asGqlError(
        filter.catch(new DomainError(BLOG_ERROR.POST_NOT_FOUND, '文章不存在'), host),
      );
      expect(err.extensions.errorCode).toBe(BLOG_ERROR.POST_NOT_FOUND);
      expect(err.extensions.errorMessage).toBe('文章不存在');
    });

    it('DomainError details 应透传', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('development'));
      const host = makeGqlHost();
      const details = { field: 'slug', value: 'dup' };

      const err = asGqlError(
        filter.catch(new DomainError(BLOG_ERROR.POST_SLUG_DUPLICATE, 'slug dup', details), host),
      );
      expect(err.extensions.details).toEqual(details);
    });
  });

  // ─── HttpException 映射 ───

  describe('HttpException 映射', () => {
    it('401 UnauthorizedException → UNAUTHENTICATED', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('production'));
      const host = makeGqlHost();

      const err = asGqlError(filter.catch(new UnauthorizedException(), host));
      expect(err.extensions.code).toBe('UNAUTHENTICATED');
      expect(err.extensions.httpStatus).toBe(401);
    });

    it('403 ForbiddenException → FORBIDDEN', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('production'));
      const host = makeGqlHost();

      const err = asGqlError(filter.catch(new ForbiddenException(), host));
      expect(err.extensions.code).toBe('FORBIDDEN');
      expect(err.extensions.httpStatus).toBe(403);
    });

    it('404 NotFoundException → NOT_FOUND', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('production'));
      const host = makeGqlHost();

      const err = asGqlError(filter.catch(new NotFoundException(), host));
      expect(err.extensions.code).toBe('NOT_FOUND');
      expect(err.extensions.httpStatus).toBe(404);
    });

    it('400 BadRequestException → BAD_USER_INPUT', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('production'));
      const host = makeGqlHost();

      const err = asGqlError(filter.catch(new HttpException('bad', 400), host));
      expect(err.extensions.code).toBe('BAD_USER_INPUT');
      expect(err.extensions.httpStatus).toBe(400);
    });

    it('500 内部错误 → INTERNAL_SERVER_ERROR', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('production'));
      const host = makeGqlHost();

      const err = asGqlError(filter.catch(new HttpException('fail', 500), host));
      expect(err.extensions.code).toBe('INTERNAL_SERVER_ERROR');
      expect(err.extensions.httpStatus).toBe(500);
    });

    it('生产环境：隐藏业务细节（errorCode/errorMessage）但保留 code', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('production'));
      const host = makeGqlHost();

      const err = asGqlError(
        filter.catch(
          new HttpException(
            { message: '详细错误', errorCode: 'SOME_CODE', errorMessage: '业务错误' },
            400,
          ),
          host,
        ),
      );
      // code 保留（由状态码映射）
      expect(err.extensions.code).toBe('BAD_USER_INPUT');
      // 生产环境不暴露 errorCode/errorMessage
      expect(err.extensions.errorCode).toBeUndefined();
      expect(err.extensions.errorMessage).toBeUndefined();
      // 生产环境使用通用消息
      expect(err.message).toBe('请求失败');
    });

    it('非生产环境：透传 errorCode/errorMessage', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('development'));
      const host = makeGqlHost();

      const err = asGqlError(
        filter.catch(
          new HttpException(
            { message: '详细错误', errorCode: 'SOME_CODE', errorMessage: '业务错误' },
            400,
          ),
          host,
        ),
      );
      expect(err.extensions.errorCode).toBe('SOME_CODE');
      expect(err.extensions.errorMessage).toBe('业务错误');
      expect(err.message).toBe('业务错误');
    });

    it('HttpException 响应体带 code 字段时应覆盖默认映射', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('development'));
      const host = makeGqlHost();

      const err = asGqlError(
        filter.catch(new HttpException({ code: 'FORBIDDEN', message: 'no access' }, 400), host),
      );
      expect(err.extensions.code).toBe('FORBIDDEN');
    });
  });

  // ─── 未知异常 ───

  describe('未知异常处理', () => {
    it('非 Error 对象 → INTERNAL_SERVER_ERROR', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('development'));
      const host = makeGqlHost();

      const err = asGqlError(filter.catch('string error', host));
      expect(err.extensions.code).toBe('INTERNAL_SERVER_ERROR');
      expect(err.extensions.httpStatus).toBe(500);
    });

    it('普通 Error → INTERNAL_SERVER_ERROR，透传 message', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('development'));
      const host = makeGqlHost();

      const err = asGqlError(filter.catch(new Error('something broke'), host));
      expect(err.extensions.code).toBe('INTERNAL_SERVER_ERROR');
      expect(err.message).toBe('something broke');
    });

    it('生产环境：未知错误隐藏细节', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('production'));
      const host = makeGqlHost();

      const err = asGqlError(filter.catch(new Error('secret details'), host));
      expect(err.message).toBe('系统繁忙，请稍后重试');
      expect(err.extensions.errorCode).toBeUndefined();
    });

    it('非生产环境：未知错误含 INTERNAL_ERROR errorCode', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('development'));
      const host = makeGqlHost();

      const err = asGqlError(filter.catch(new Error('oops'), host));
      expect(err.extensions.errorCode).toBe('INTERNAL_ERROR');
    });
  });

  // ─── HTTP 请求旁路 ───

  describe('HTTP 请求旁路', () => {
    it('HTTP 类型请求应走默认 BaseExceptionFilter（不返回 GraphQLError）', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('development'));
      // BaseExceptionFilter 需要完整的 ArgumentsHost（含 getArgByIndex 等方法）
      // 只验证分支逻辑：当 host.getType() === 'http' 时不进入 GraphQL 分支
      const mockCatch = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(filter)), 'catch');

      const httpHost = {
        getType: () => 'http',
        getArgByIndex: jest.fn().mockReturnValue({}),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({}),
          getResponse: jest.fn().mockReturnValue({ header: jest.fn() }),
          getNext: jest.fn(),
        }),
      } as unknown as ArgumentsHost;

      // super.catch 会调用原始实现（可能抛出或返回 void），不影响测试目标
      try {
        filter.catch(new UnauthorizedException(), httpHost);
      } catch {
        // BaseExceptionFilter 在 http 模式下可能抛异常（测试环境无 res 对象），符合预期
      }

      // 关键验证：走了 super.catch 而非 GraphQL 分支
      expect(mockCatch).toHaveBeenCalled();
      mockCatch.mockRestore();
    });
  });

  // ─── GraphQL path 映射 ───

  describe('GraphQL path', () => {
    it('应包含 fieldName 作为 path', () => {
      const filter = new GqlAllExceptionsFilter(makeConfig('development'));
      const host = makeGqlHost('createBlogPost');

      const err = asGqlError(
        filter.catch(new DomainError(BLOG_ERROR.POST_NOT_FOUND, 'not found'), host),
      );
      expect(err.path).toEqual(['createBlogPost']);
    });
  });
});
