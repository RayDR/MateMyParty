import { HttpException } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ZodError } from 'zod';

export class ApiError extends HttpException {
  constructor(status: number, code: string, message: string, details?: unknown) {
    super({ code, message, status, ...(details === undefined ? {} : { details }) }, status);
  }
}

export function parseInput<T>(schema: ZodType<T>, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Request validation failed',
        error.flatten().fieldErrors,
      );
    }
    throw error;
  }
}
