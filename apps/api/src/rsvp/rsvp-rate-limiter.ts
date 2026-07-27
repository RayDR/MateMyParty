import { createHmac, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

type Bucket = { startedAt: number; attempts: number };

@Injectable()
export class RsvpRateLimiter {
  private readonly secret = randomBytes(32);
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly maximumAttempts = 20,
    private readonly windowMilliseconds = 10 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  consume(material: string): boolean {
    const key = createHmac('sha256', this.secret).update(material).digest('hex');
    const now = this.now();
    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.startedAt >= this.windowMilliseconds) {
      this.buckets.set(key, { startedAt: now, attempts: 1 });
      this.prune(now);
      return true;
    }
    bucket.attempts += 1;
    return bucket.attempts <= this.maximumAttempts;
  }

  private prune(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.startedAt >= this.windowMilliseconds) this.buckets.delete(key);
    }
    while (this.buckets.size > 20_000) {
      const oldest = this.buckets.keys().next().value as string | undefined;
      if (!oldest) break;
      this.buckets.delete(oldest);
    }
  }
}
