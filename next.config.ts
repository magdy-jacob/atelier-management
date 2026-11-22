import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only the configured project's public catalogue image bucket is allowed.
  images: {
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [
          new URL(
            "/storage/v1/object/public/dress-images/**",
            process.env.NEXT_PUBLIC_SUPABASE_URL,
          ),
        ]
      : [],
  },
  cacheComponents: false,
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
