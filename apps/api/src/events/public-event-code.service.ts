import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { EventsRepository } from './events.repository';

const PUBLIC_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PUBLIC_CODE_LENGTH = 8;
const MAX_COLLISION_RETRIES = 8;

@Injectable()
export class PublicEventCodeService {
  constructor(private readonly repository: EventsRepository) {}

  generate(): string {
    return Array.from(
      { length: PUBLIC_CODE_LENGTH },
      () => PUBLIC_CODE_ALPHABET[randomInt(PUBLIC_CODE_ALPHABET.length)],
    ).join('');
  }

  async generateUnique(): Promise<string> {
    for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt += 1) {
      const candidate = this.generate();
      if (!(await this.repository.isPublicCodeTaken(candidate))) return candidate;
    }
    throw new Error('Unable to allocate a unique public event code');
  }
}
