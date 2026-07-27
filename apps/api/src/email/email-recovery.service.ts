import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { EmailDeliveryRepository } from './email-delivery.repository';

@Injectable()
export class EmailRecoveryService implements OnApplicationBootstrap {
  constructor(private readonly repository: EmailDeliveryRepository) {}

  async onApplicationBootstrap() {
    await this.repository.markInterrupted(new Date(Date.now() - 15 * 60_000));
  }
}
