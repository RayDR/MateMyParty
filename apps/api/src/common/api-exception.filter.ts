import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : null;
    if (typeof payload === 'object' && payload && 'code' in payload) {
      response.status(status).send(payload);
      return;
    }
    const message = status === 500 ? 'Internal server error' : this.safeMessage(payload);
    response.status(status).send({ code: this.codeFor(status), message, status });
  }

  private safeMessage(payload: string | object | null): string {
    if (typeof payload === 'string') return payload;
    if (payload && 'message' in payload) {
      const message = payload.message;
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.join(', ');
    }
    return 'Request failed';
  }

  private codeFor(status: number): string {
    return (
      (
        { 400: 'BAD_REQUEST', 401: 'UNAUTHORIZED', 404: 'NOT_FOUND', 409: 'CONFLICT' } as Record<
          number,
          string
        >
      )[status] ?? 'INTERNAL_ERROR'
    );
  }
}
