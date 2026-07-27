import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HostEventsPage from '../app/host/events/page';
import HostGuestsPage from '../app/host/events/[identifier]/guests/page';
import HostPreviewPage from '../app/host/events/[identifier]/preview/page';

const navigation = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND');
  }),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock('next/navigation', () => navigation);

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  navigation.redirect.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe('protected host page redirects', () => {
  it.each([
    ['dashboard', () => HostEventsPage()],
    [
      'guest management UUID route',
      () =>
        HostGuestsPage({
          params: Promise.resolve({ identifier: '22222222-2222-4222-8222-222222222222' }),
        }),
    ],
    [
      'preview route',
      () => HostPreviewPage({ params: Promise.resolve({ identifier: 'raymundo-6' }) }),
    ],
  ])('sends an unauthenticated %s request to the public platform', async (_name, page) => {
    await expect(page()).rejects.toThrow('REDIRECT:https://matemyparty.domoforge.com/host/access');
    expect(navigation.redirect).toHaveBeenCalledWith(
      'https://matemyparty.domoforge.com/host/access',
    );
  });
});
