/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: true,
    serverActionsBodySizeLimit: '50mb',
    serverComponentsExternalPackages: ['jszip'],
  },
};

module.exports = nextConfig;
