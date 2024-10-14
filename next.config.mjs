// next.config.mjs

const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Ignorar módulos específicos en el lado del cliente
      config.resolve.fallback = {
        fs: false,
        encoding: false,
      };
    }
    return config;
  },
};

export default nextConfig;
