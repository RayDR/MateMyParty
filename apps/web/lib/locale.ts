import { isLocale, type Locale } from '@matemyparty/i18n';
import { cookies, headers } from 'next/headers';
import { LOCALE_COOKIE } from './locale-cookie';

export function resolveLocale(value: string | string[] | undefined, fallback: string): Locale {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate && isLocale(candidate)) return candidate;
  return isLocale(fallback) ? fallback : 'en-US';
}

export function localeFromAcceptLanguage(value: string | null): Locale | null {
  if (!value) return null;
  const candidates = value
    .split(',')
    .map((part) => {
      const [language, ...parameters] = part.trim().split(';');
      const quality = Number(
        parameters.find((parameter) => parameter.trim().startsWith('q='))?.split('=')[1] ?? 1,
      );
      return { language: language?.toLowerCase() ?? '', quality };
    })
    .sort((left, right) => right.quality - left.quality);
  for (const candidate of candidates) {
    if (candidate.language === 'es-mx' || candidate.language === 'es') return 'es-MX';
    if (candidate.language === 'en-us' || candidate.language === 'en') return 'en-US';
  }
  return null;
}

export function resolveLocalePriority({
  manualLocale,
  invitationLocale,
  acceptLanguage,
  eventLocale,
}: {
  manualLocale?: string | null;
  invitationLocale?: string | null;
  acceptLanguage?: string | null;
  eventLocale?: string | null;
}): Locale {
  if (manualLocale && isLocale(manualLocale)) return manualLocale;
  if (invitationLocale && isLocale(invitationLocale)) return invitationLocale;
  const browserLocale = localeFromAcceptLanguage(acceptLanguage ?? null);
  if (browserLocale) return browserLocale;
  if (eventLocale && isLocale(eventLocale)) return eventLocale;
  return 'en-US';
}

export async function resolveRequestLocale(options?: {
  invitationLocale?: string | null;
  eventLocale?: string | null;
}): Promise<Locale> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveLocalePriority({
    manualLocale: cookieStore.get(LOCALE_COOKIE)?.value,
    invitationLocale: options?.invitationLocale,
    acceptLanguage: headerStore.get('accept-language'),
    eventLocale: options?.eventLocale,
  });
}
