import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

@Injectable()
export class InvitationTokenService {
  generate() {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hash(token), prefix: token.slice(0, 8) };
  }

  isValidFormat(token: string): boolean {
    return PUBLIC_TOKEN_PATTERN.test(token);
  }

  hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  matches(hash: string, candidate: string): boolean {
    const left = Buffer.from(hash, 'hex');
    const right = Buffer.from(candidate, 'hex');
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
