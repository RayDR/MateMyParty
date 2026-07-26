import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDictionary, isLocale } from '@matemyparty/i18n';
import { HostAccess } from '../../../components/host-access';
import { HOST_SESSION_COOKIE, validSessionValue } from '../../../lib/host-session';

export const dynamic = 'force-dynamic';

export default async function HostAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ accessError?: string; locale?: string }>;
}) {
  const query = await searchParams;
  const locale = query.locale && isLocale(query.locale) ? query.locale : 'en-US';
  const hasSession = validSessionValue((await cookies()).get(HOST_SESSION_COOKIE)?.value ?? '');
  if (hasSession) redirect('/host/events');
  return (
    <HostAccess
      dictionary={getDictionary(locale)}
      invalid={query.accessError === '1'}
      locale={locale}
    />
  );
}
