/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/',
        destination: '/index.html',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/rpc',
        destination: 'https://rpc.pulsechain.com',
      },
    ];
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'ethers'];
    }
    return config;
  },
};

module.exports = nextConfig;