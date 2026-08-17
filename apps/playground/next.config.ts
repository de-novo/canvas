import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@denovo/canvas-core",
    "@denovo/canvas-three",
    "@denovo/canvas-web",
    "@denovo/react-canvas"
  ]
};

export default nextConfig;
