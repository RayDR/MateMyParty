import { Body, Controller, Delete, Get, Headers, Patch, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ApiError } from '../common/api-error';
import { RsvpRateLimiter } from './rsvp-rate-limiter';
import { RsvpService } from './rsvp.service';

@Controller('api/rsvp')
export class PublicRsvpController {
  constructor(
    private readonly rsvp: RsvpService,
    private readonly rateLimiter: RsvpRateLimiter,
  ) {}

  @Get()
  current(
    @Headers('x-invitation-token') permanentToken?: string,
    @Headers('x-invitation-grant') grantToken?: string,
  ) {
    return this.rsvp.current({ permanentToken, grantToken });
  }

  @Post()
  create(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Headers('x-invitation-token') permanentToken?: string,
    @Headers('x-invitation-grant') grantToken?: string,
  ) {
    this.limit(request.ip, permanentToken, grantToken);
    return this.rsvp.create({ permanentToken, grantToken }, body);
  }

  @Patch()
  update(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Headers('x-invitation-token') permanentToken?: string,
    @Headers('x-invitation-grant') grantToken?: string,
  ) {
    this.limit(request.ip, permanentToken, grantToken);
    return this.rsvp.update({ permanentToken, grantToken }, body);
  }

  @Delete()
  cancel(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Headers('x-invitation-token') permanentToken?: string,
    @Headers('x-invitation-grant') grantToken?: string,
  ) {
    this.limit(request.ip, permanentToken, grantToken);
    return this.rsvp.cancel({ permanentToken, grantToken }, body);
  }

  private limit(ip: string, permanentToken?: string, grantToken?: string) {
    if (!this.rateLimiter.consume(`${ip}|${permanentToken ?? grantToken ?? 'missing'}`)) {
      throw new ApiError(429, 'RATE_LIMITED', 'Too many requests');
    }
  }
}
