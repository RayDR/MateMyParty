'use client';

import { useState } from 'react';
import { getDictionary, type Locale } from '@matemyparty/i18n';
import { Card } from '@matemyparty/ui';
import { LanguageSelector } from './language-selector';

export function PlatformLanding({ initialLocale = 'en-US' }: { initialLocale?: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const dictionary = getDictionary(locale);
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#312e81,#020617_62%)] p-5">
      <div className="w-full max-w-2xl">
        <div className="mb-5 flex justify-end">
          <LanguageSelector locale={locale} dictionary={dictionary} onChange={setLocale} />
        </div>
        <Card>
          <div className="py-12 text-center">
            <div className="mx-auto mb-8 h-16 w-16 rotate-6 rounded-2xl bg-gradient-to-br from-violet-400 to-cyan-300 shadow-lg shadow-violet-500/30" />
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">
              {dictionary.common.platformName}
            </h1>
            <p className="mx-auto mt-6 max-w-lg text-lg leading-8 text-slate-300">
              {dictionary.common.inConstruction}
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
