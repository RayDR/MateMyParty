import type { Metadata } from 'next';
import { getDictionary } from '@matemyparty/i18n';
import { InvalidInvitation, PublicInvitation } from '../../../components/public-invitation';
import { getInvitationByGrant } from '../../../lib/invitations';
import { resolveRequestLocale } from '../../../lib/locale';

export const dynamic = 'force-dynamic';

const dictionary = getDictionary('en-US');
export const metadata: Metadata = {
  title: dictionary.invitation.pageTitle,
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    title: dictionary.invitation.pageTitle,
    description: dictionary.common.platformName,
  },
};

export default async function InvitationAccessPage({
  params,
}: {
  params: Promise<{ grant: string }>;
}) {
  const invitation = await getInvitationByGrant((await params).grant);
  const locale = await resolveRequestLocale({
    invitationLocale: invitation?.locale,
    eventLocale: invitation?.event.locale,
  });
  return invitation ? (
    <PublicInvitation invitation={invitation} locale={locale} />
  ) : (
    <InvalidInvitation locale={locale} />
  );
}
