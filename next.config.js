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

  // FIXED WEBPACK CONFIGURATION
  webpack: (config, { isServer, webpack }) => {
    // 1. Server-side: externalize client-only packages
    if (isServer) {
      config.externals = [
        ...config.externals,
        "better-sqlite3",
        "bcryptjs",
        "multer",
        // CRITICAL: Externalize client-only libraries completely
        { "react-toastify": "react-toastify" },
        { "react-masonry-css": "react-masonry-css" },
      ];
    }

    // 2. Client-side: provide self polyfill
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
      };
    }

    // 3. Completely separate chunks
    config.optimization.splitChunks = {
      chunks: "all",
      cacheGroups: {
        default: false,
        vendors: false,
        // Server-only vendor
        ...(isServer && {
          serverVendor: {
            test: /[\\/]node_modules[\\/](better-sqlite3|bcryptjs|multer)/,
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
    // IMPORTANT: Specify server-only packages
    serverComponentsExternalPackages: ["better-sqlite3", "bcryptjs", "multer"],
  },

  // 6. Transpile client-only packages properly
  transpilePackages: ["react-toastify", "react-masonry-css"],

  // output: "standalone",
};

module.exports = nextConfig;
