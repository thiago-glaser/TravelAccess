/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Enables instrumentation.js — used to patch console with timestamps at startup
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
