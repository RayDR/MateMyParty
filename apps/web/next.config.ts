import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  logging: { incomingRequests: { ignore: [/^\/i\//, /^\/invitation$/] } },
  transpilePackages: ['@matemyparty/contracts', '@matemyparty/i18n', '@matemyparty/ui'],
  async headers() {
    return [
      {
        source: '/i/:path*',
        headers: privateInvitationHeaders,
      },
      {
        source: '/invitation',
        headers: privateInvitationHeaders,
      },
    ];
  },
};

const privateInvitationHeaders = [
  { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
];

export default nextConfig;
