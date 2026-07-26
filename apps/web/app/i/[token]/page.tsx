import type { Metadata } from 'next';
import { getDictionary } from '@matemyparty/i18n';
import { InvalidInvitation, PublicInvitation } from '../../../components/public-invitation';
import { getPublicInvitation } from '../../../lib/invitations';

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

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const invitation = await getPublicInvitation((await params).token);
  return invitation ? <PublicInvitation invitation={invitation} /> : <InvalidInvitation />;
}
