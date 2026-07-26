import type { Metadata } from 'next';
import { InvalidInvitation, PublicInvitation } from '../../../components/public-invitation';
import { invitationMetadata } from '../../../lib/invitation-metadata';
import { getPublicInvitation } from '../../../lib/invitations';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  return invitationMetadata(await getPublicInvitation((await params).token));
}

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const invitation = await getPublicInvitation((await params).token);
  return invitation ? <PublicInvitation invitation={invitation} /> : <InvalidInvitation />;
}
