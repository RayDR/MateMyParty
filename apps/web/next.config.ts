import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  logging: { incomingRequests: { ignore: [/^\/i\//] } },
  transpilePackages: ['@matemyparty/contracts', '@matemyparty/i18n', '@matemyparty/ui'],
};

export default nextConfig;
