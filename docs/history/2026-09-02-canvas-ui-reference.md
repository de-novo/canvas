# 2026-09-02 Canvas UI reference

## Date

2026-09-02

## Scope

Record what [canvasui.dev](https://canvasui.dev/) is and is not, after a
live read of the site, docs, and GitHub. Documentation only. No schema,
facade export, dependency, or playground change.

## Changes

- Named Canvas UI as a neighbor product, not a source to wrap.
- Linked the decision from [Product Identity](../product-identity.md),
  [Framework Surface](../framework-surface.md),
  [Dependency Strategy](../dependency-strategy.md), and
  [Project Status](../project-status.md).

Canvas UI is a shadcn-style **effect component registry**. Install is
`npx shadcn@latest add @canvas-ui/<name>-<framework>`. Source is copied
into the host repo. About 35 rooms (Liquid, Glass, Shatter, Particle
Reveal, Blaze, and object variants that take GLB/glTF/SVG/image). Six
wrappers share one engine and the same props: React, Solid, Preact,
Vue, Svelte, vanilla TypeScript.

The draw path is experimental
[HTML-in-Canvas](https://developer.chrome.com/blog/html-in-canvas-origin-trial)
(Chrome origin trial). Live DOM is painted into a canvas texture that
shaders sample. Text stays selectable and links stay clickable. Without
that API, content is ordinary HTML and some effects still overlay GPU
on top.

Two renderer builds keep one public API (`create()`, options,
`setOptions()`, `destroy()`):

- WebGL: GLSL, widest support.
- WebGPU: WGSL through **vgpu**, plus Three for object effects. One
  shared `GPUDevice` per page. Missing `navigator.gpu` returns `null`
  so wrappers keep the HTML and drop the effect.

Agent install uses the shadcn MCP against the `@canvas-ui` registry.
License is MIT + Commons Clause: free inside an app; the components
themselves may not be resold or redistributed.

Canvas UI and Denovo share the words “canvas” and “WebGPU.” They do
not share a product:

| | Canvas UI | Denovo |
| --- | --- | --- |
| Unit | effect component | document + kind + named op |
| Host writes | `<Liquid>` + children HTML | closed JSON props |
| GPU | host picks the WebGL or WebGPU build | runtime `auto` / explicit backend |
| Framework | one engine, six wrappers | document first, adapters after |
| Install | copy source | facade package |

Wrapping a Canvas UI room fails the absorption test the same way
wrapping a ThreeUI room does. Delete the upstream component and the
pixels are gone. `html` plus Liquid is hosting, not a kind.

vgpu is confirmed as **their** WebGPU engine, not a candidate facade
dependency. That matches the 2026-08-28 vgpu catalog decision: restate
the sayable graphic (`plugin.denovo.shade`), do not take the shader
library.

Steal as reference only:

- WebGL and WebGPU as two builds with the same public props;
- no-GPU path keeps content and does not throw;
- pause when off-screen or reduced-motion;
- one-command agent install (their MCP; our analog is named ops).

Do not steal:

- `vgpu` or `@canvas-ui/*` as a dependency;
- shader source, effect name, or a component tree as a kind property;
- landing-page GPU chrome as the product;
- HTML-in-Canvas as a required `html` drawer. That API is a Chrome
  148–150 origin trial. Our `html` kind stays a DOM overlay until a
  later, sayable contract exists.

## Verification

Inspected 2026-09-02: https://canvasui.dev/, `/docs`, `/docs/rendering`,
`/docs/mcp`, `/components`, and
https://github.com/DavidHDev/canvas-ui.

Documentation gates ran after this entry:

- `pnpm verify:docs` — 162 Markdown files, 520/520 local targets,
  0 symlinks, 0 conflict markers, 4/4 contributor entrypoints,
  4/4 repository skills, 5/5 project-status headings, 6/6
  pull-request headings

## Residual risk

- The name “Canvas UI” will keep colliding with this repository in
  search and agent prompts. Status and identity must keep the layer
  split explicit.
- HTML-in-Canvas may become a later research path for `html`. It is
  not a now slice and must not become a document field.

## Next action

Documented. Do not wrap Canvas UI. Do not add `vgpu`. Expand official
kinds only when the next pattern is sayable.
