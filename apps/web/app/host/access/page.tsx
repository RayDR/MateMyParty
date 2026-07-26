import { HostAccess } from '../../../components/host-access';
import { resolveRequestLocale } from '../../../lib/locale';

export const dynamic = 'force-dynamic';

export default async function HostAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ accessError?: string; returnTo?: string }>;
}) {
  const query = await searchParams;
  const returnTo =
    typeof query.returnTo === 'string' &&
    /^\/host\/events\/[0-9a-f-]{36}\/guests$/.test(query.returnTo)
      ? query.returnTo
      : '/host/events';
  return (
    <HostAccess
      locale={await resolveRequestLocale()}
      returnTo={returnTo}
      invalid={query.accessError === '1'}
    />
  );
}
