import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

const WINDOW_MILLISECONDS = 15 * 60 * 1000;
const MAXIMUM_ATTEMPTS = 5;

@Injectable()
export class InvitationLookupRateLimiter {
  private readonly attempts = new Map<string, number[]>();

  consume(clientAddress: string, now = Date.now()): boolean {
    const key = createHash('sha256')
      .update(`${process.env.HOST_ADMIN_TOKEN ?? 'matemyparty'}:${clientAddress}`)
      .digest('hex');
    const cutoff = now - WINDOW_MILLISECONDS;
    const recent = (this.attempts.get(key) ?? []).filter((attempt) => attempt > cutoff);
    if (recent.length >= MAXIMUM_ATTEMPTS) {
      this.attempts.set(key, recent);
      return false;
    }
    recent.push(now);
    this.attempts.set(key, recent);
    return true;
  }
}
