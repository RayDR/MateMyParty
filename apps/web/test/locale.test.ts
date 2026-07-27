import { describe, expect, it } from 'vitest';
import { resolveLocalePreference } from '../lib/locale';

describe('locale preference', () => {
  it('uses manual cookie before invitation and browser language', () => {
    expect(
      resolveLocalePreference({
        manualCookie: 'es-MX',
        invitationLocale: 'en-US',
        acceptLanguage: 'en-US,en;q=0.9',
        eventDefaultLocale: 'en-US',
      }),
    ).toBe('es-MX');
  });

  it('uses invitation, browser, event, and en-US in order', () => {
    expect(resolveLocalePreference({ invitationLocale: 'es-MX', acceptLanguage: 'en-US' })).toBe(
      'es-MX',
    );
    expect(resolveLocalePreference({ acceptLanguage: 'es-ES,es;q=0.8' })).toBe('es-MX');
    expect(resolveLocalePreference({ eventDefaultLocale: 'es-MX' })).toBe('es-MX');
    expect(resolveLocalePreference({})).toBe('en-US');
  });
});
