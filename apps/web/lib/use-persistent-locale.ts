'use client';

import { useCallback, useEffect, useState } from 'react';
import { isLocale, type Locale } from '@matemyparty/i18n';
import { LANGUAGE_COOKIE } from './invitation-access';

export function usePersistentLocale(initialLocale: Locale): [Locale, (locale: Locale) => void] {
  const [locale, setLocale] = useState(initialLocale);

  useEffect(() => {
    const stored = document.cookie
      .split(';')
      .map((part) => part.trim().split('='))
      .find(([name]) => name === LANGUAGE_COOKIE)?.[1];
    if (stored && isLocale(decodeURIComponent(stored)))
      setLocale(decodeURIComponent(stored) as Locale);
  }, []);

  const select = useCallback((nextLocale: Locale) => {
    setLocale(nextLocale);
    void fetch('/internal/locale', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locale: nextLocale }),
    }).catch(() => undefined);
  }, []);

  return [locale, select];
}
