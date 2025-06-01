/** @type {import('next').NextConfig} */
const nextConfig = {
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  generateEtags: true,

  // Image optimization
  images: {
    domains: ["res.cloudinary.com"],
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 31536000,
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },

  // UPDATED WEBPACK CONFIGURATION FOR POSTGRESQL
  webpack: (config, { isServer, webpack }) => {
    // 1. Server-side: externalize client-only packages
    if (isServer) {
      config.externals = [
        ...config.externals,
        // CHANGED: Replace better-sqlite3 with pg
        "pg",
        "pg-native", // PostgreSQL native bindings
        "bcryptjs",
        "multer",
        // CRITICAL: Externalize client-only libraries completely
        { "react-toastify": "react-toastify" },
        { "react-masonry-css": "react-masonry-css" },
      ];
    }

    // 2. Client-side: provide self polyfill and disable Node.js modules
    if (!isServer) {
      config.plugins.push(
        new webpack.DefinePlugin({
          "typeof self": JSON.stringify("object"),
          self: "globalThis",
        })
      );

      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        path: false,
        os: false,
        // PostgreSQL specific fallbacks
        dns: false,
        stream: false,
        util: false,
        buffer: false,
        events: false,
      };
    }

    // 3. Completely separate chunks
    config.optimization.splitChunks = {
      chunks: "all",
      cacheGroups: {
        default: false,
        vendors: false,
        // Server-only vendor - UPDATED for PostgreSQL
        ...(isServer && {
          serverVendor: {
            test: /[\\/]node_modules[\\/](pg|pg-native|bcryptjs|multer)/,
            name: "server-vendor",
            chunks: "all",
            priority: 20,
            enforce: true,
          },
        }),
        // Client-only vendor - SEPARATE completely
        ...(!isServer && {
          clientVendor: {
            test: /[\\/]node_modules[\\/](react-toastify|react-masonry-css)/,
            name: "client-vendor",
            chunks: "all",
            priority: 20,
            enforce: true,
          },
        }),
      },
    };

    return config;
  },

  // 5. Experimental features with proper separation
  experimental: {
    scrollRestoration: true,
    esmExternals: "loose",
    // UPDATED: Specify PostgreSQL server-only packages
    serverComponentsExternalPackages: ["pg", "pg-native", "bcryptjs", "multer"],
  },

  // 6. Transpile client-only packages properly
  transpilePackages: ["react-toastify", "react-masonry-css"],

  // Disable SWC and use Babel instead
  swcMinify: false,
  compiler: {
    // Disable SWC
    swc: false,
  },
};

module.exports = nextConfig;