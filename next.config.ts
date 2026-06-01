import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // pdfjs-dist optionally requires canvas — stub it out in Next.js
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
