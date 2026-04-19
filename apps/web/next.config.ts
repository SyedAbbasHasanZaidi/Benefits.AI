import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Rules service URL rewrites for local dev (prod routes direct to Fly.io)
  async rewrites() {
    if (process.env.NODE_ENV !== 'production') {
      return [
        {
          source: '/api/rules/:path*',
          destination: `${process.env.RULES_SERVICE_URL ?? 'http://localhost:8001'}/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
