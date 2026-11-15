import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @chimp-arena/shared ships raw TS source (no build step) - this tells
  // Next.js to run it through its own transpiler like any other app code,
  // same as every monorepo workspace package.
  transpilePackages: ["@chimp-arena/shared"],
  // Dev log screenshots go up through a Server Action (app/devlog). Vercel
  // caps a request at 4.5 MB; the page shrinks images to fit under this.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
