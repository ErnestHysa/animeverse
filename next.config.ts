import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude client-only pages from static generation
  output: "standalone",

  turbopack: {
    // Keep Turbopack scoped to this app so production builds do not walk parent folders.
    root: path.resolve(process.cwd()),
  },

  experimental: {
    // The sandbox blocks child-process workers, so keep webpack builds in-process.
    webpackBuildWorker: false,
    // Worker thread serialization can fail on modern Next builds when route modules
    // contain non-clonable values, so prefer the more stable single-process path.
    workerThreads: false,
    cpus: 1,
  },

  typescript: {
    // We run `next typegen` + `tsc --noEmit` before builds in package scripts/CI.
    ignoreBuildErrors: true,
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
