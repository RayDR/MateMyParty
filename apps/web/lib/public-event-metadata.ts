import type { Metadata } from 'next';
import type { PublicEventLanding } from '@matemyparty/contracts';
import type { Locale } from '@matemyparty/i18n';

export function publicEventMetadata(event: PublicEventLanding, locale: Locale): Metadata {
  const content = event.localizedContent[locale];
  const thumbnail = event.presentation.thumbnailRef;
  const imageUrl = thumbnail?.startsWith('https://')
    ? thumbnail
    : thumbnail && event.primaryHostname
      ? `https://${event.primaryHostname}${thumbnail}`
      : null;
  return {
    title: content.headline,
    description: content.description,
    openGraph: {
      title: content.headline,
      description: content.description,
      images: imageUrl ? [{ url: imageUrl, alt: content.thumbnailAltText }] : undefined,
    },
  };
}
