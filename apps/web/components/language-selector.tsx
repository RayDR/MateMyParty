'use client';

import type { Dictionary, Locale } from '@matemyparty/i18n';

export function LanguageSelector({
  locale,
  dictionary,
  onChange,
}: {
  locale: Locale;
  dictionary: Dictionary;
  onChange: (locale: Locale) => void;
}) {
  async function selectLocale(nextLocale: Locale) {
    onChange(nextLocale);
    await fetch('/internal/locale', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locale: nextLocale }),
    }).catch(() => undefined);
  }
  return (
    <label className="flex items-center gap-3 text-sm text-slate-200">
      <span>{dictionary.common.languageSelector}</span>
      <select
        className="rounded-xl border border-white/20 bg-slate-900 px-3 py-2"
        value={locale}
        onChange={(event) => void selectLocale(event.target.value as Locale)}
      >
        <option value="en-US">{dictionary.common.english}</option>
        <option value="es-MX">{dictionary.common.spanish}</option>
      </select>
    </label>
  );
}
