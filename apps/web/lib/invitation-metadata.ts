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
      twitter: {
        card: 'summary',
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
  const canonicalUrl = invitation.shareMetadata.hostname
    ? `https://${invitation.shareMetadata.hostname}/`
    : undefined;
  const images = imageUrl
    ? [{ url: imageUrl, width: 1200, height: 630, alt: content.thumbnailAltText }]
    : undefined;
  return {
    title: content.title,
    description,
    robots: { index: false, follow: false, nocache: true },
    alternates: canonicalUrl ? { canonical: canonicalUrl } : undefined,
    openGraph: {
      type: 'website',
      url: canonicalUrl,
      siteName: neutralDictionary.common.platformName,
      title: content.title,
      description,
      images,
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title: content.title,
      description,
      images: imageUrl ? [{ url: imageUrl, alt: content.thumbnailAltText }] : undefined,
    },
  };
}

function absoluteMediaUrl(reference: string | null, hostname: string | null) {
  if (!reference) return null;
  if (reference.startsWith('https://')) return reference;
  return hostname ? `https://${hostname}${reference}` : null;
}
