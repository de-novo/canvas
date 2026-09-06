import { chromium } from "playwright";

export const PIXEL_CHROMIUM_ARGS = ["--disable-features=WebGPU"];
export const WEBGPU_CHROMIUM_ARGS = [
  "--enable-unsafe-webgpu",
  "--enable-webgpu-developer-features"
];

function gpuAngleBackend() {
  if (process.platform === "darwin") {
    return "metal";
  }
  if (process.platform === "win32") {
    return "d3d11";
  }
  return "vulkan";
}

/** Headless Chromium flags that request a hardware GPU instead of SwiftShader. */
export function gpuChromiumArgs() {
  return [
    "--enable-gpu",
    "--ignore-gpu-blocklist",
    "--disable-software-rasterizer",
    "--use-gl=angle",
    `--use-angle=${gpuAngleBackend()}`,
    "--disable-gpu-sandbox"
  ];
}

export function launchPixelChromium(options = {}) {
  const { args = [], ...rest } = options;
  return chromium.launch({
    ...rest,
    args: [...PIXEL_CHROMIUM_ARGS, ...args]
  });
}

export function launchWebGpuChromium(options = {}) {
  const { args = [], ...rest } = options;
  return chromium.launch({
    ...rest,
    args: [...WEBGPU_CHROMIUM_ARGS, ...args]
  });
}

export function launchGpuChromium(options = {}) {
  const { args = [], ...rest } = options;
  return chromium.launch({
    headless: true,
    ...rest,
    args: [...gpuChromiumArgs(), ...PIXEL_CHROMIUM_ARGS, ...args]
  });
}
