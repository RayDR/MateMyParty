import type { EventsRepository } from '../src/events/events.repository';
import { PublicEventCodeService } from '../src/events/public-event-code.service';

describe('PublicEventCodeService', () => {
  it('generates URL-safe non-sequential codes', () => {
    const service = new PublicEventCodeService({} as EventsRepository);
    expect(service.generate()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it('retries a collision before returning a unique code', async () => {
    const repository = {
      isPublicCodeTaken: jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
    } as unknown as EventsRepository;
    const service = new PublicEventCodeService(repository);
    jest.spyOn(service, 'generate').mockReturnValueOnce('ABCDEFGH').mockReturnValueOnce('SQ52LQE9');
    await expect(service.generateUnique()).resolves.toBe('SQ52LQE9');
    expect(repository.isPublicCodeTaken).toHaveBeenCalledTimes(2);
  });
});
