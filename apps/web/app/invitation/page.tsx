import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { InvalidInvitation, PublicInvitation } from '../../components/public-invitation';
import { INVITATION_ACCESS_COOKIE, LANGUAGE_COOKIE } from '../../lib/invitation-access';
import { invitationMetadata } from '../../lib/invitation-metadata';
import { getGrantInvitation } from '../../lib/invitations';
import { resolveLocalePreference } from '../../lib/locale';

export const dynamic = 'force-dynamic';

async function invitationAndLocale() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const grant = cookieStore.get(INVITATION_ACCESS_COOKIE)?.value;
  const invitation = grant ? await getGrantInvitation(grant) : null;
  const locale = resolveLocalePreference({
    manualCookie: cookieStore.get(LANGUAGE_COOKIE)?.value,
    invitationLocale: invitation?.invitationLocale,
    acceptLanguage: headerStore.get('accept-language') ?? undefined,
    eventDefaultLocale: invitation?.event.defaultLocale,
  });
  return { invitation, locale };
}

export async function generateMetadata(): Promise<Metadata> {
  const { invitation, locale } = await invitationAndLocale();
  return invitationMetadata(invitation, locale);
}

export default async function VerifiedInvitationPage() {
  const { invitation, locale } = await invitationAndLocale();
  return invitation ? (
    <PublicInvitation invitation={invitation} initialLocale={locale} />
  ) : (
    <InvalidInvitation locale={locale} />
  );
}
