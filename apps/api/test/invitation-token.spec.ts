import { InvitationTokenService } from '../src/invitations/invitation-token.service';
import { PublicInvitationUrlService } from '../src/invitations/public-invitation-url.service';

describe('InvitationTokenService', () => {
  const service = new InvitationTokenService();

  it('creates a URL-safe token with 256 bits of entropy and stores a one-way hash', () => {
    const result = service.generate();
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.hash).not.toContain(result.token);
    expect(service.matches(result.hash, service.hash(result.token))).toBe(true);
  });

  it('rejects malformed public tokens', () => {
    expect(service.isValidFormat('not-a-valid-token')).toBe(false);
  });
});

describe('PublicInvitationUrlService', () => {
  it('prefers the event hostname for production HTTPS links', () => {
    const previous = {
      environment: process.env.NODE_ENV,
      protocol: process.env.PUBLIC_APP_PROTOCOL,
      hostname: process.env.PRIMARY_APP_HOSTNAME,
    };
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_APP_PROTOCOL = 'https';
    process.env.PRIMARY_APP_HOSTNAME = 'matemyparty.domoforge.com';
    expect(
      new PublicInvitationUrlService().build('A'.repeat(43), 'raymundo6th.domoforge.com'),
    ).toBe(`https://raymundo6th.domoforge.com/i/${'A'.repeat(43)}`);
    restoreEnvironment('NODE_ENV', previous.environment);
    restoreEnvironment('PUBLIC_APP_PROTOCOL', previous.protocol);
    restoreEnvironment('PRIMARY_APP_HOSTNAME', previous.hostname);
  });

  it('never emits localhost or arbitrary hosts in production links', () => {
    const previous = {
      environment: process.env.NODE_ENV,
      hostname: process.env.PRIMARY_APP_HOSTNAME,
    };
    process.env.NODE_ENV = 'production';
    process.env.PRIMARY_APP_HOSTNAME = 'localhost:3200';
    const service = new PublicInvitationUrlService();
    expect(service.build('A'.repeat(43), 'attacker.example')).toBe(
      `https://matemyparty.domoforge.com/i/${'A'.repeat(43)}`,
    );
    restoreEnvironment('NODE_ENV', previous.environment);
    restoreEnvironment('PRIMARY_APP_HOSTNAME', previous.hostname);
  });
});

function restoreEnvironment(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
