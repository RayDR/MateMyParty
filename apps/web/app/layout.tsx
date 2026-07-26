import type { Metadata } from 'next';
import { getDictionary } from '@matemyparty/i18n';
import './globals.css';

const dictionary = getDictionary('en-US');
export const metadata: Metadata = {
  title: dictionary.common.platformName,
  description: dictionary.common.inConstruction,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-US">
      <body>{children}</body>
    </html>
  );
}
