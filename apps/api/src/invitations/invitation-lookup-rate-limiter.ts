import { createHmac, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

type Bucket = {
  startedAt: number;
  attempts: number;
};

type InvitationLookupRateLimiterOptions = {
  maximumAttempts?: number;
  windowMilliseconds?: number;
  now?: () => number;
};

const maximumBuckets = 20_000;
const defaultMaximumAttempts = 5;
const defaultWindowMilliseconds = 10 * 60 * 1000;

@Injectable()
export class InvitationLookupRateLimiter {
  private readonly secret = randomBytes(32);
  private readonly buckets = new Map<string, Bucket>();
  private maximumAttempts: number;
  private windowMilliseconds: number;
  private now: () => number;

  constructor() {
    this.maximumAttempts = defaultMaximumAttempts;
    this.windowMilliseconds = defaultWindowMilliseconds;
    this.now = Date.now;
  }

  static createForTesting(
    options: InvitationLookupRateLimiterOptions = {},
  ): InvitationLookupRateLimiter {
    const limiter = new InvitationLookupRateLimiter();

    limiter.maximumAttempts =
      options.maximumAttempts ?? defaultMaximumAttempts;
    limiter.windowMilliseconds =
      options.windowMilliseconds ?? defaultWindowMilliseconds;
    limiter.now = options.now ?? Date.now;

    return limiter;
  }

  consume(requestKeyMaterial: string): boolean {
    const key = createHmac('sha256', this.secret)
      .update(requestKeyMaterial)
      .digest('hex');

    const now = this.now();
    const current = this.buckets.get(key);

    if (!current || now - current.startedAt >= this.windowMilliseconds) {
      this.buckets.set(key, {
        startedAt: now,
        attempts: 1,
      });

      this.prune(now);
      return true;
    }

    current.attempts += 1;
    return current.attempts <= this.maximumAttempts;
  }

  private prune(now: number): void {
    if (this.buckets.size < 1000) {
      return;
    }

    for (const [key, bucket] of this.buckets) {
      if (now - bucket.startedAt >= this.windowMilliseconds) {
        this.buckets.delete(key);
      }
    }

    while (this.buckets.size > maximumBuckets) {
      const oldest = this.buckets.keys().next().value as string | undefined;

      if (!oldest) {
        break;
      }

      this.buckets.delete(oldest);
    }
  }
}
