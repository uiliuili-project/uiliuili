import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ['@uiliuili/danmaku', '@uiliuili/i18n', '@uiliuili/shared'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001'}/api/:path*`,
      },
      {
        source: '/media/:path*',
        destination: `${process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001'}/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
