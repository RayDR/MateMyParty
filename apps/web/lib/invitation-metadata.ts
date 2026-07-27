import type { Metadata } from 'next';
import type { PrivateInvitation } from '@matemyparty/contracts';
import { getDictionary, type Locale } from '@matemyparty/i18n';

export function invitationMetadata(
  invitation: PrivateInvitation | null,
  locale: Locale = 'en-US',
): Metadata {
  const neutralDictionary = getDictionary(locale);
  if (!invitation) {
    return {
      title: neutralDictionary.invitation.pageTitle,
      description: neutralDictionary.common.platformName,
      robots: { index: false, follow: false, nocache: true },
      openGraph: {
        title: neutralDictionary.invitation.pageTitle,
        description: neutralDictionary.common.platformName,
      },
    };
  }
  const content = invitation.event.localizedContent[locale];
  const description = getDictionary(locale).invitation.shareGeneric.replace(
    '{eventTitle}',
    content.title,
  );
  const imageUrl = absoluteMediaUrl(
    invitation.shareMetadata.thumbnailImageRef,
    invitation.shareMetadata.hostname,
  );
  return {
    title: content.title,
    description,
    robots: { index: false, follow: false, nocache: true },
    openGraph: {
      title: content.title,
      description,
      images: imageUrl
        ? [
            {
              url: imageUrl,
              alt: content.thumbnailAltText,
            },
          ]
        : undefined,
    },
  };
}

function absoluteMediaUrl(reference: string | null, hostname: string | null) {
  if (!reference) return null;
  if (reference.startsWith('https://')) return reference;
  return hostname ? `https://${hostname}${reference}` : null;
}
