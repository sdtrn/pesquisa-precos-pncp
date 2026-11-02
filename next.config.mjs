import fs from "node:fs";
import path from "node:path";

const localAppDataDeps = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "PesquisaPrecosPNCP_Vercel_deps", "node_modules")
  : null;

const hasLocalDeps = Boolean(localAppDataDeps && fs.existsSync(localAppDataDeps));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: hasLocalDeps,
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        zlib: false,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    if (hasLocalDeps && localAppDataDeps) {
      config.cache = false;
      config.resolve.modules = [
        ...(config.resolve.modules || []),
        localAppDataDeps,
      ];
      config.resolveLoader = config.resolveLoader || {};
      config.resolveLoader.modules = [
        ...(config.resolveLoader.modules || []),
        localAppDataDeps,
      ];
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^\.[\\/]([A-Za-z]:[\\/])/,
          (resource) => {
            resource.request = resource.request.replace(/^\.[\\/]/, "");
          }
        )
      );
    }
    return config;
  },
};

export default nextConfig;
