import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const hostname = process.env.PRIMARY_APP_HOSTNAME ?? 'matemyparty.domoforge.com';
  const protocol = process.env.PUBLIC_APP_PROTOCOL ?? 'https';
  const origin = `${protocol}://${hostname}`;

  return [
    { url: origin, changeFrequency: 'monthly', priority: 1 },
    { url: `${origin}/events/raymundo-6`, changeFrequency: 'weekly', priority: 0.8 },
  ];
}
