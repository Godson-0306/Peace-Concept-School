import type { NextConfig } from "next";

const apiOrigin = process.env.API_PROXY_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // Cursor port-forward / Simple Browser often opens via 127.0.0.1 while
  // Next.dev defaults to localhost — without this, client chunks return 403
  // and interactive forms (login Staff/Student tabs) never hydrate.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.localhost",
    "*.cursor.sh",
    "*.cursorapi.com",
  ],
  // Less UI chrome overhead in Simple Browser / port-forwarded previews.
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async rewrites() {
    // Media still proxied via rewrite; JSON API uses app/api/[...path]/route.ts
    return [
      {
        source: "/media/:path*",
        destination: `${apiOrigin}/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
