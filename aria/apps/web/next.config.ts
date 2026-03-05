import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['@aria/shared', '@aria/core'],
  },
  async rewrites() {
    return [
      {
        source: '/api/tts/:path*',
        destination: 'http://localhost:3001/api/tts/:path*',
      },
    ];
  },
};

export default nextConfig;
