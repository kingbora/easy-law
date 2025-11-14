const isProd = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: '.next',
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NODE_ENV === 'production' 
      ? 'https://easy-lay.top' 
      : 'http://localhost:3000',
    NEXT_PUBLIC_RESTFUL_BASE_URL: process.env.NODE_ENV === 'production'
      ? 'https://easy-lay.top/restful'
      : 'http://localhost:4000/restful'
  },
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  compiler: {
    removeConsole: isProd,
  }
};

export default nextConfig;
