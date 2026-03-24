/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    // Memory optimization to prevent OOM crashes
    memoryLimit: 4096, // 4GB memory limit
  },

  // Exclude client-only pages from static generation
  output: 'standalone',

  serverExternalPackages: ["webtorrent"],

  // Cache configuration to prevent unbounded growth
  experimental: {
    // Optimize webpack/Turbopack cache behavior
    incrementalCacheHandlerPath: undefined,
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "s4.anilist.co",
      },
      {
        protocol: "https",
        hostname: "**.anilist.co",
      },
      {
        protocol: "https",
        hostname: "**.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "**.googlevideo.com",
      },
    ],
  },

  // PWA manifest
  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
