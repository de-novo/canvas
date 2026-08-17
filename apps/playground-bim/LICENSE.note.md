# BIM example assets

## `public/sample.ifc`

Source: `examples/example.ifc` from
[ThatOpen/engine_web-ifc](https://github.com/ThatOpen/engine_web-ifc), licensed
under **MPL-2.0** (the engine_web-ifc project license). Used here as an
end-to-end smoke fixture for the `WebIfcBimAdapter`. See the upstream repository
for the full license text.

## `public/wasm/`

Copied at build time (see `package.json` `copy:wasm` script /
`scripts/copy-web-ifc-wasm.mjs`) from `node_modules/web-ifc/`. Not committed —
regenerated on `dev`/`build`. The `web-ifc.wasm` binary is part of the
[web-ifc](https://github.com/ThatOpen/engine_web-ifc) package (MPL-2.0).
