import { createHmac, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

type Bucket = {
  startedAt: number;
  attempts: number;
};

type RsvpRateLimiterOptions = {
  maximumAttempts?: number;
  windowMilliseconds?: number;
  now?: () => number;
};

const maximumBuckets = 20_000;
const defaultMaximumAttempts = 20;
const defaultWindowMilliseconds = 10 * 60 * 1000;

@Injectable()
export class RsvpRateLimiter {
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
    options: RsvpRateLimiterOptions = {},
  ): RsvpRateLimiter {
    const limiter = new RsvpRateLimiter();

    limiter.maximumAttempts =
      options.maximumAttempts ?? defaultMaximumAttempts;
    limiter.windowMilliseconds =
      options.windowMilliseconds ?? defaultWindowMilliseconds;
    limiter.now = options.now ?? Date.now;

    return limiter;
  }

  consume(material: string): boolean {
    const key = createHmac('sha256', this.secret)
      .update(material)
      .digest('hex');

    const now = this.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now - bucket.startedAt >= this.windowMilliseconds) {
      this.buckets.set(key, {
        startedAt: now,
        attempts: 1,
      });

      this.prune(now);
      return true;
    }

    bucket.attempts += 1;
    return bucket.attempts <= this.maximumAttempts;
  }

  private prune(now: number): void {
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
