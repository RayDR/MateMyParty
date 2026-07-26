import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import {
  HostAdminTokenGuard,
  validateHostAdminConfiguration,
} from '../src/auth/host-admin-token.guard';

function context(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
  } as unknown as ExecutionContext;
}

describe('HostAdminTokenGuard', () => {
  const original = process.env.HOST_ADMIN_TOKEN;
  afterEach(() => {
    process.env.HOST_ADMIN_TOKEN = original;
  });

  it('returns 401 semantics when Authorization is missing or incorrect', () => {
    process.env.HOST_ADMIN_TOKEN = 'correct-token-with-more-than-32-characters';
    const guard = new HostAdminTokenGuard();
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context('Bearer incorrect'))).toThrow(UnauthorizedException);
  });

  it('accepts the exact bearer token', () => {
    process.env.HOST_ADMIN_TOKEN = 'correct-token-with-more-than-32-characters';
    expect(
      new HostAdminTokenGuard().canActivate(context(`Bearer ${process.env.HOST_ADMIN_TOKEN}`)),
    ).toBe(true);
  });

  it('refuses an insecure production configuration', () => {
    expect(() =>
      validateHostAdminConfiguration({ NODE_ENV: 'production', HOST_ADMIN_TOKEN: 'change-me' }),
    ).toThrow();
  });
});
