# Public Type Contract Hardening

Date: 2026-07-14

## Scope

Audit generated declarations and improve public authoring types before broader
M3 tool APIs make weak contracts harder to change.

## Changes

- Confirmed that generated package declarations expose no explicit `any`.
- Replaced the open `Record<string, JsonValue>` node patch type with fields and
  value types derived from the built-in node union. Node identity and type are
  explicitly immutable.
- Replaced untyped editor selection input with `SelectionStateInput` and gave
  renderer-update, hit-selection, and tool-input callbacks concrete results.
- Restricted plugin command declarations and handler registration to the
  `plugin.${string}` namespace.
- Parameterized renderer adapter options and made facade custom renderers
  receive the complete `CreateCanvasOptions` contract.
- Added correlated worker task maps so a task name determines its payload and
  promise result.
- Made authoring helpers accept exact input types while preserving `unknown` at
  `safeDefine*`, parser, validation, error, heterogeneous registry, and dynamic
  worker-protocol boundaries.
- Extended public API verification with positive and negative TypeScript
  fixtures and a generated-declaration scan that rejects explicit `any`.

## Verification

Passed:

```sh
pnpm typecheck
pnpm build
pnpm verify:document-schema
pnpm verify:editor-core
pnpm verify:hit-testing
pnpm verify:public-api
pnpm verify:browser-rendering
```

The consumer fixtures prove correct patch, selection, renderer option, plugin
command, callback, and worker protocol inference. Expected compiler errors prove
that arbitrary patch fields, invalid field values, invalid selection values,
built-in command handler registration, unknown worker tasks, and mismatched
worker payloads are rejected.

The repository-local Markdown link audit passed for 39 Markdown files with zero
missing local targets. The configured external `doc-governance` scripts are not
installed in this environment, so those commands were not reported as passing.

## Residual Risk

- A standalone `CanvasNodePatch` cannot correlate fields with a runtime node ID;
  editor validation remains responsible for rejecting fields that belong to a
  different built-in node kind.
- Custom node patch typing will need an explicit plugin-owned type registry when
  custom persisted nodes become part of the document union.
- `unknown` remains intentional where callers have not declared a worker task
  map or where external data has not yet crossed validation.

## Next Action

Carry the same schema-derived, discriminated, negative-fixture approach into the
next rotation and scale authoring contracts.
