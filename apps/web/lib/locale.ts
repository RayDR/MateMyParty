import { isLocale, type Locale } from '@matemyparty/i18n';

export function resolveLocale(value: string | string[] | undefined, fallback: string): Locale {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate && isLocale(candidate)) return candidate;
  return isLocale(fallback) ? fallback : 'en-US';
}

export function resolveLocalePreference({
  manualCookie,
  invitationLocale,
  acceptLanguage,
  eventDefaultLocale,
}: {
  manualCookie?: string;
  invitationLocale?: string;
  acceptLanguage?: string;
  eventDefaultLocale?: string;
}): Locale {
  if (manualCookie && isLocale(manualCookie)) return manualCookie;
  if (invitationLocale && isLocale(invitationLocale)) return invitationLocale;
  const browserLocales = (acceptLanguage ?? '')
    .split(',')
    .map((entry) => entry.split(';')[0]!.trim());
  for (const browserLocale of browserLocales) {
    if (isLocale(browserLocale)) return browserLocale;
    if (browserLocale.toLowerCase().startsWith('es')) return 'es-MX';
    if (browserLocale.toLowerCase().startsWith('en')) return 'en-US';
  }
  return eventDefaultLocale && isLocale(eventDefaultLocale) ? eventDefaultLocale : 'en-US';
}
