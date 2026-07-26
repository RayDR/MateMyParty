import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

export function secureStringEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function validateHostAdminConfiguration(environment: NodeJS.ProcessEnv): void {
  if (environment.NODE_ENV !== 'production') return;
  const token = environment.HOST_ADMIN_TOKEN ?? '';
  const knownExamples = ['local-development-host-token-change-me-2026', 'change-me', 'matemyparty'];
  if (token.length < 32 || knownExamples.some((value) => token.toLowerCase().includes(value))) {
    throw new Error('Production requires a strong HOST_ADMIN_TOKEN with at least 32 characters');
  }
}

@Injectable()
export class HostAdminTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authorization = request.headers.authorization ?? '';
    const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const expected = process.env.HOST_ADMIN_TOKEN ?? '';
    if (!expected || !supplied || !secureStringEqual(supplied, expected))
      throw new UnauthorizedException('Host access denied');
    return true;
  }
}
