import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const hostname = process.env.PRIMARY_APP_HOSTNAME ?? 'matemyparty.domoforge.com';
  const protocol = process.env.PUBLIC_APP_PROTOCOL ?? 'https';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/i/', '/private-media/'],
    },
    sitemap: `${protocol}://${hostname}/sitemap.xml`,
  };
}
