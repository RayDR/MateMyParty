import type { Metadata } from 'next';
import type { PublicInvitation } from '@matemyparty/contracts';
import { getDictionary } from '@matemyparty/i18n';

export function invitationMetadata(invitation: PublicInvitation | null): Metadata {
  const neutralDictionary = getDictionary('en-US');
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
  const metadata = invitation.shareMetadata;
  return {
    title: metadata.title,
    description: metadata.description,
    robots: { index: false, follow: false, nocache: true },
    openGraph: {
      title: metadata.title,
      description: metadata.description,
      images: metadata.thumbnailImageRef
        ? [{ url: metadata.thumbnailImageRef, alt: metadata.thumbnailAltText }]
        : undefined,
    },
  };
}
