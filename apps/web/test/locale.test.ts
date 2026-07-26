import { describe, expect, it } from 'vitest';
import { resolveLocalePriority } from '../lib/locale';

describe('locale priority', () => {
  it('prefers manual cookie, invitation, browser, event, then en-US', () => {
    expect(
      resolveLocalePriority({
        manualLocale: 'es-MX',
        invitationLocale: 'en-US',
        acceptLanguage: 'en-US',
        eventLocale: 'en-US',
      }),
    ).toBe('es-MX');
    expect(resolveLocalePriority({ invitationLocale: 'es-MX', acceptLanguage: 'en-US' })).toBe(
      'es-MX',
    );
    expect(resolveLocalePriority({ acceptLanguage: 'es-MX, en;q=0.8' })).toBe('es-MX');
    expect(resolveLocalePriority({ eventLocale: 'es-MX' })).toBe('es-MX');
    expect(resolveLocalePriority({})).toBe('en-US');
  });
});
