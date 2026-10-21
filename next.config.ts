import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @chimp-arena/shared ships raw TS source (no build step) - this tells
  // Next.js to run it through its own transpiler like any other app code,
  // same as every monorepo workspace package.
  transpilePackages: ["@chimp-arena/shared"],
};

export default nextConfig;
