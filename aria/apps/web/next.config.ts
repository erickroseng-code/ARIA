import type { NextConfig } from 'next';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'https://aria-api-avq0.onrender.com';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['@aria/shared', '@aria/core'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
