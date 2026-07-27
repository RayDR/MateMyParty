import { Module } from '@nestjs/common';
import { parseEnvironment } from '@matemyparty/config';
import { EventsModule } from '../events/events.module';
import { InvitationsModule } from '../invitations/invitations.module';
import { EmailCsrfGuard } from './email-csrf.guard';
import { EmailDeliveryController } from './email-delivery.controller';
import { EmailDeliveryRepository } from './email-delivery.repository';
import { EmailDeliveryService } from './email-delivery.service';
import { EMAIL_PROVIDER } from './email-provider';
import { EmailConcurrencyGate, EmailRateLimiter } from './email-rate-limiter';
import { EmailRecoveryService } from './email-recovery.service';
import { SmtpEmailProvider } from './smtp-email.provider';
import { DisabledEmailProvider, StubEmailProvider } from './stub-email.provider';

@Module({
  imports: [EventsModule, InvitationsModule],
  controllers: [EmailDeliveryController],
  providers: [
    EmailCsrfGuard,
    EmailDeliveryRepository,
    EmailDeliveryService,
    EmailRateLimiter,
    EmailConcurrencyGate,
    EmailRecoveryService,
    {
      provide: EMAIL_PROVIDER,
      useFactory: () => {
        const environment = parseEnvironment(process.env);
        if (environment.EMAIL_PROVIDER === 'smtp') return new SmtpEmailProvider(environment);
        if (environment.EMAIL_PROVIDER === 'disabled') return new DisabledEmailProvider();
        return new StubEmailProvider();
      },
    },
  ],
  exports: [EmailDeliveryRepository, EmailDeliveryService],
})
export class EmailModule {}
