# M3 Authoring Tools Verification

Date: 2026-07-16

## Scope

Record the final acceptance evidence for M3 Authoring Tools. Current milestone
status remains owned by [Project Status](../project-status.md); this entry is
chronological evidence, not a second status index.

## Changes

- Closed the M3 verification gate after the complete authoring contract had
  already passed its repository-owned checks.
- Preserved exact public contracts: schema-derived node patches,
  mode-correlated 2D/3D inputs and runtimes, descriptor-correlated plugin
  commands, namespaced plugin tool IDs, and literal built-in tool IDs.
- Preserved responsibility boundaries: core owns schemas and migrations,
  editor core owns tool sessions and command semantics, web runtimes own
  renderer math and previews, and the facade owns capability wiring and public
  composition.
- Kept unsupported backends, invalid configurations, cancelled async sessions,
  and unavailable capabilities explicit. No compatibility substitution or
  placeholder registration was added to satisfy the milestone.
- Recovered the configured external documentation-governance bundle from its
  deletion-time backup. All 15 functional files match that backup byte for
  byte; the skill remains external to this repository as required by the
  repository documentation policy.

## Verification

The complete repository baseline passed:

```sh
pnpm typecheck
pnpm build
pnpm verify:public-api
pnpm verify:document-schema
pnpm verify:editor-core
pnpm verify:hit-testing
pnpm verify:browser-rendering
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-conflicts.py --root .
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

The browser suite exercised desktop mouse and real mobile touch workflows for
2D and 3D creation, transforms, snapping, groups/layers, measurements,
annotations, undo/redo, strict JSON reload, and renderer replacement. The
declaration audit found zero explicit `any` occurrences across 17 generated
public declaration files. Documentation checks found no conflict files,
external symlinks, duplicate phase claims, schema violations, missing expected
paths, or broken local links; Obsidian help and vault-level checks both
succeeded.

## Residual Risk

- The non-blocking Vite advisory for the vanilla example's approximately
  985-KiB production chunk is performance work, not an M3 correctness failure.
- General migration registries, patch persistence, storage, and synchronization
  remain M6 responsibilities.
- The documentation-governance tool is an external workstation dependency and
  must be installed or restored in fresh environments before running the
  mandatory audit.

## Next Action

Define M4 Performance Layer workloads and measurable thresholds before adding
instancing, batching, culling, LOD, workers, or spatial-query APIs.
