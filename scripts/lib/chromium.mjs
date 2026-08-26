import { chromium } from "playwright";

export const PIXEL_CHROMIUM_ARGS = ["--disable-features=WebGPU"];
export const WEBGPU_CHROMIUM_ARGS = [
  "--enable-unsafe-webgpu",
  "--enable-webgpu-developer-features"
];

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
