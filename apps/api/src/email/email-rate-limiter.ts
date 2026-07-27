import { Injectable } from '@nestjs/common';
import { parseEnvironment } from '@matemyparty/config';
import { ApiError } from '../common/api-error';

@Injectable()
export class EmailRateLimiter {
  private readonly attempts = new Map<string, number[]>();
  private readonly limit = parseEnvironment(process.env).EMAIL_RATE_LIMIT_PER_MINUTE;

  assertAllowed(key: string, now = Date.now()) {
    const cutoff = now - 60_000;
    const recent = (this.attempts.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
    if (recent.length >= this.limit) {
      throw new ApiError(429, 'EMAIL_RATE_LIMITED', 'Email rate limit reached');
    }
    recent.push(now);
    this.attempts.set(key, recent);
  }
}

@Injectable()
export class EmailConcurrencyGate {
  private active = 0;
  private readonly pending: Array<() => void> = [];
  private readonly limit = parseEnvironment(process.env).EMAIL_SEND_CONCURRENCY;

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      if (this.pending.length >= 50) {
        throw new ApiError(503, 'EMAIL_QUEUE_BUSY', 'Email delivery is temporarily busy');
      }
      await new Promise<void>((resolve) => this.pending.push(resolve));
    }
    this.active += 1;
    try {
      return await operation();
    } finally {
      this.active -= 1;
      this.pending.shift()?.();
    }
  }
}
