import type { NextConfig } from 'next';

const privateHeaders = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
  { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
];

const nextConfig: NextConfig = {
  logging: { incomingRequests: { ignore: [/^\/i\//, /^\/a\//, /^\/private-media\//] } },
  transpilePackages: ['@matemyparty/contracts', '@matemyparty/i18n', '@matemyparty/ui'],
  async headers() {
    return [
      {
        source: '/i/:path*',
        headers: privateHeaders,
      },
      {
        source: '/a/:path*',
        headers: privateHeaders,
      },
      {
        source: '/private-media/:path*',
        headers: privateHeaders,
      },
    ];
  },
};

export default nextConfig;
