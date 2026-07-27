import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ApiError } from '../common/api-error';

@Injectable()
export class EmailCsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();
    if (request.headers['x-mmp-csrf'] !== '1') {
      throw new ApiError(403, 'CSRF_CHECK_FAILED', 'Request verification failed');
    }
    return true;
  }
}
