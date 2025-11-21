const isProd = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: '.next',
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
    reactRemoveProperties: isProd
  },
  experimental: {
    optimizeCss: true,
  },
  poweredByHeader: false,
  compress: isProd,
   // 优化 webpack 配置
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // 解决大字符串序列化警告
    if (!dev && !isServer) {
      // 禁用缓存，减少内存开销
      config.cache = false;
      
      // 优化 chunk 分割
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: 10,
              chunks: 'all',
            },
            common: {
              name: 'common',
              minChunks: 2,
              priority: 5,
              chunks: 'all',
            },
          },
        },
        minimize: true,
      };
    }
    
    return config;
  },
};

export default nextConfig;