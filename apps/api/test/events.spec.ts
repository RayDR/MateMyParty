import { NotFoundException } from '@nestjs/common';
import type { EventsRepository } from '../src/events/events.repository';
import { EventsService } from '../src/events/events.service';

const row = {
  celebrantName: 'Raymundo',
  celebrantAge: 6,
  locale: 'en-US',
  publicSlug: 'raymundo-6',
  templateKey: 'kids-night-dragon',
  templateVersion: 1,
};

describe('EventsService', () => {
  it('normalizes and resolves an event by hostname', async () => {
    let received = '';
    const repository = {
      findByHostname: async (hostname: string) => {
        received = hostname;
        return row;
      },
      findBySlug: async () => row,
      listForHost: async () => [],
    } as unknown as EventsRepository;
    const result = await new EventsService(repository).byHostname(
      ' Raymundo6th.Domoforge.com:443 ',
    );
    expect(received).toBe('raymundo6th.domoforge.com');
    expect(result.publicSlug).toBe('raymundo-6');
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('startsAt');
    expect(result).not.toHaveProperty('venueName');
  });

  it('returns 404 semantics for an unknown hostname', async () => {
    const repository = {
      findByHostname: async () => null,
      findBySlug: async () => null,
      listForHost: async () => [],
    } as unknown as EventsRepository;
    await expect(
      new EventsService(repository).byHostname('unknown.example'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists protected host events with a safe management identifier and hostname', async () => {
    const repository = {
      findByHostname: async () => row,
      findBySlug: async () => row,
      listForHost: async () => [
        {
          id: '22222222-2222-4222-8222-222222222222',
          title: 'Raymundo’s 6th Birthday',
          publicSlug: 'raymundo-6',
          primaryHostname: 'raymundo6th.domoforge.com',
        },
      ],
    } as unknown as EventsRepository;
    await expect(new EventsService(repository).listForHost()).resolves.toEqual([
      expect.objectContaining({
        id: '22222222-2222-4222-8222-222222222222',
        publicSlug: 'raymundo-6',
      }),
    ]);
  });
});
