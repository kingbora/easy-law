const isProd = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NODE_ENV === 'production' 
      ? 'https://www.mydomain.com' 
      : 'http://localhost:3000',
    NEXT_PUBLIC_RESTFUL_BASE_URL: process.env.NODE_ENV === 'production'
      ? 'https://www.mydomain.com/restful'
      : 'http://localhost:4000/restful'
  },
  images: {
    unoptimized: true,
  },
  compiler: {
    removeConsole: isProd,
  }
};

export default nextConfig;
