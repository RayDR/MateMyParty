import type { ExecutionContext } from '@nestjs/common';
import { EmailCsrfGuard } from '../src/email/email-csrf.guard';

function context(value?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: { 'x-mmp-csrf': value } }) }),
  } as unknown as ExecutionContext;
}

describe('EmailCsrfGuard', () => {
  it('allows only the exact internal mutation marker', () => {
    const guard = new EmailCsrfGuard();
    expect(guard.canActivate(context('1'))).toBe(true);
    expect(() => guard.canActivate(context())).toThrow();
    expect(() => guard.canActivate(context('true'))).toThrow();
  });
});
