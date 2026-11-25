# Security Policy

## Supported Versions

This repository is currently on `0.1.x`. Security fixes land on `main`.
There is no long-term support branch yet.

## Reporting a Vulnerability

Do not open a public GitHub issue for security reports.

Use GitHub's private advisory form:

https://github.com/de-novo/canvas/security/advisories/new

Include:

- the affected package (`@de-novo/canvas`, `@de-novo/canvas-editor`, and so on);
- a description of the issue and impact;
- steps to reproduce, or a proof of concept if you have one;
- any known workarounds.

Please give maintainers a reasonable window to publish a fix before any
public disclosure.

## Scope

In scope:

- published workspace packages under `packages/`;
- document parse, command, and persistence boundaries that accept untrusted
  input;
- XSS or HTML-injection paths in the 2D overlay and adapters.

Out of scope:

- vulnerabilities only in optional peer engines (Three.js, web-ifc, framework
  runtimes) that are not caused by Denovo wrapping;
- sample IFC files and copied WASM under `apps/playground-bim/public/`.

## HTML Overlay

Runtime `html` nodes must not assign untrusted strings to `innerHTML`.
String content is `textContent`. Host-supplied `HTMLElement`s are the
escape hatch for markup.
