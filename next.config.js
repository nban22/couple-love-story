/** @type {import('next').NextConfig} */
const nextConfig = {
  // Performance optimizations for production deployment
  compress: true,              // Enable gzip compression
  poweredByHeader: false,      // Remove X-Powered-By header for security
  generateEtags: true,         // Enable ETag generation for caching
  
  // Image optimization configuration for Cloudinary integration
  images: {
    domains: ['res.cloudinary.com'],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 31536000, // 1 year cache TTL for static images
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Security headers implementation
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'  // Prevent clickjacking attacks
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'  // Prevent MIME type sniffing
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'  // Control referrer information
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'  // Disable sensitive APIs
          }
        ]
      },
      {
        // API-specific caching headers
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0'  // Prevent API response caching
          }
        ]
      }
    ];
  },
  
  // Webpack bundle optimization
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Implement code splitting strategy for optimal loading performance
    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    };
    
    return config;
  },
  
  // Experimental features - use with caution in production
  experimental: {
    scrollRestoration: true,     // Maintain scroll position on navigation,
    esmExternals: false,
  },
};

module.exports = nextConfig;