import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { InvalidInvitation, PublicInvitation } from '../../../components/public-invitation';
import { LANGUAGE_COOKIE } from '../../../lib/invitation-access';
import { invitationMetadata } from '../../../lib/invitation-metadata';
import { getPublicInvitation } from '../../../lib/invitations';
import { resolveLocalePreference } from '../../../lib/locale';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const invitation = await getPublicInvitation((await params).token);
  const locale = await preferredLocale(
    invitation?.invitationLocale,
    invitation?.event.defaultLocale,
  );
  return invitationMetadata(invitation, locale);
}

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const invitation = await getPublicInvitation((await params).token);
  const locale = await preferredLocale(
    invitation?.invitationLocale,
    invitation?.event.defaultLocale,
  );
  return invitation ? (
    <PublicInvitation invitation={invitation} initialLocale={locale} />
  ) : (
    <InvalidInvitation locale={locale} />
  );
}

async function preferredLocale(invitationLocale?: string, eventDefaultLocale?: string) {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveLocalePreference({
    manualCookie: cookieStore.get(LANGUAGE_COOKIE)?.value,
    invitationLocale,
    acceptLanguage: headerStore.get('accept-language') ?? undefined,
    eventDefaultLocale,
  });
}
