import { HealthController } from '../src/health/health.controller';

describe('Health endpoint', () => {
  it('returns the service health payload', async () => {
    const expected = {
      status: 'ok' as const,
      database: 'up' as const,
      timestamp: new Date().toISOString(),
      version: 'test',
    };
    const controller = new HealthController({ check: async () => expected } as never);
    await expect(controller.check()).resolves.toEqual(expected);
  });
});
