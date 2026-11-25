import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@de-novo/canvas",
    "@de-novo/canvas-core",
    "@de-novo/canvas-three",
    "@de-novo/canvas-web",
    "@de-novo/react-canvas"
  ]
};

export default nextConfig;
