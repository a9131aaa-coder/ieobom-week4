import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // mock JSON을 Vercel 함수 배포에 반드시 포함합니다.
  outputFileTracingIncludes: {
    '/api/dashboard': ['./data/dashboard.json'],
    '/api/suggest': ['./data/dashboard.json'],
  },
};
export default nextConfig;
