'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Dictionary, Locale } from '@matemyparty/i18n';
import { LOCALE_COOKIE } from '../lib/locale-cookie';

export function LanguageSelector({
  locale,
  dictionary,
  onChange,
}: {
  locale: Locale;
  dictionary: Dictionary;
  onChange?: (locale: Locale) => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(locale);

  function select(nextLocale: Locale) {
    setSelected(nextLocale);
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    onChange?.(nextLocale);
    router.refresh();
  }

  return (
    <label className="flex items-center gap-3 text-sm text-slate-200">
      <span>{dictionary.common.languageSelector}</span>
      <select
        className="rounded-xl border border-white/20 bg-slate-900 px-3 py-2"
        value={selected}
        onChange={(event) => select(event.target.value as Locale)}
      >
        <option value="en-US">{dictionary.common.english}</option>
        <option value="es-MX">{dictionary.common.spanish}</option>
      </select>
    </label>
  );
}
