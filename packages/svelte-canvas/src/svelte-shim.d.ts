/**
 * Ambient declaration so `tsc` can resolve `*.svelte` imports without the
 * svelte2tsx type generator. Consumers using Vite + @sveltejs/vite-plugin-svelte
 * get the real, prop-typed declarations from the Svelte compiler; this shim
 * only exists to keep the package's own `tsc --noEmit` green.
 */
declare module "*.svelte" {
  import type { Component } from "svelte";
  const component: Component<Record<string, unknown>>;
  export default component;
}
