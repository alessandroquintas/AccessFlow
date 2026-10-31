import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O canto inferior esquerdo é do rodapé da sidebar (usuário e persona).
  devIndicators: { position: "bottom-right" },
  cacheComponents: true,
  partialPrefetching: true,
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
