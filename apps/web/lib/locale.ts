import { isLocale, type Locale } from '@matemyparty/i18n';

export function resolveLocale(value: string | string[] | undefined, fallback: string): Locale {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate && isLocale(candidate)) return candidate;
  return isLocale(fallback) ? fallback : 'en-US';
}
