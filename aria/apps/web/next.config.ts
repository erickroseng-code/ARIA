import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['@aria/shared', '@aria/core'],
  },
};

export default nextConfig;
