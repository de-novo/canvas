// @ts-check
/**
 * External consumer packaging smoke verifier.
 *
 * Runs `pnpm pack` for every publishable package under `packages/`, inspects
 * every packed tarball to guarantee:
 * 1. Packed `package.json` contains zero unresolved `workspace:` specifiers.
 * 2. Every file declared in `exports` (`import`, `require`, `types`, `svelte`,
 *    `solid`, or string subpath like `./styles.css`) exists inside the tarball.
 * 3. Standard open-source metadata (`license`, `repository`, `homepage`, `bugs`,
 *    `publishConfig.access === "public"`) is present.
 * 4. Unpacking the core/editor/facade tarballs into an isolated temp directory
 *    allows Node ESM to import `@de-novo/canvas/2d` and execute `defineDocument`,
 *    `createEditor`, `setNodeVisible`, `subscribeCanvasSelector`, and
 *    `shallowEqual` cleanly outside the monorepo.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createCheckRunner } from "./lib/checks.mjs";

const { check, report } = createCheckRunner();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = path.join(root, "packages");
const tempDir = mkdtempSync(path.join(os.tmpdir(), "denovo-pack-smoke-"));

function collectExportTargets(exportsField) {
  const targets = new Set();
  function walk(value) {
    if (typeof value === "string") {
      if (value.startsWith("./")) {
        targets.add(value.slice(2));
      }
      return;
    }
    if (value && typeof value === "object") {
      for (const child of Object.values(value)) {
        walk(child);
      }
    }
  }
  walk(exportsField);
  return [...targets];
}

/** @type {Map<string, { dir: string, name: string, tgzPath: string }>} */
const packed = new Map();

try {
  const packageDirs = readdirSync(packagesDir)
    .map((entry) => path.join(packagesDir, entry))
    .filter((entry) => existsSync(path.join(entry, "package.json")))
    .sort();

  for (const dir of packageDirs) {
    const sourceManifest = JSON.parse(
      readFileSync(path.join(dir, "package.json"), "utf8")
    );
    const pkgName = sourceManifest.name;

    await check(`pack-inspect:${pkgName}`, () => {
      const output = execFileSync(
        "pnpm",
        ["pack", "--pack-destination", tempDir],
        { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
      ).trim();
      const lines = output.split(/\r?\n/).filter(Boolean);
      const tgzPath = lines[lines.length - 1];
      assert.ok(
        tgzPath && existsSync(tgzPath),
        `${pkgName}: expected packed tarball path, got: ${output}`
      );
      packed.set(pkgName, { dir, name: pkgName, tgzPath });

      const tarEntries = execFileSync("tar", ["-tzf", tgzPath], {
        encoding: "utf8"
      })
        .split(/\r?\n/)
        .filter(Boolean)
        .map((entry) => entry.replace(/^package\//, ""));
      const entrySet = new Set(tarEntries);

      const packedPkgRaw = execFileSync(
        "tar",
        ["-xOzf", tgzPath, "package/package.json"],
        { encoding: "utf8" }
      );
      assert.ok(
        !packedPkgRaw.includes("workspace:"),
        `${pkgName}: packed package.json must not contain workspace: protocol`
      );
      const packedPkg = JSON.parse(packedPkgRaw);
      assert.equal(packedPkg.license, "Apache-2.0");
      assert.equal(packedPkg.publishConfig?.access, "public");
      assert.ok(
        typeof packedPkg.repository?.url === "string" &&
          packedPkg.repository.url.includes("de-novo/canvas"),
        `${pkgName}: missing repository.url`
      );
      assert.ok(
        typeof packedPkg.homepage === "string" && packedPkg.homepage.length > 0,
        `${pkgName}: missing homepage`
      );
      assert.ok(
        typeof packedPkg.bugs?.url === "string" && packedPkg.bugs.url.length > 0,
        `${pkgName}: missing bugs.url`
      );

      const exportTargets = collectExportTargets(packedPkg.exports);
      assert.ok(exportTargets.length > 0, `${pkgName}: exports must declare targets`);
      for (const target of exportTargets) {
        assert.ok(
          entrySet.has(target),
          `${pkgName}: declared export target "${target}" missing from tarball`
        );
      }

      // Apache-2.0 §4(a)/(d): every distributed package tarball must include
      // exact copies of root LICENSE and NOTICE.
      for (const legalFile of ["LICENSE", "NOTICE"]) {
        assert.ok(
          entrySet.has(legalFile),
          `${pkgName}: tarball missing required ${legalFile}`
        );
        const packedLegal = execFileSync(
          "tar",
          ["-xOzf", tgzPath, `package/${legalFile}`],
          { encoding: "utf8" }
        );
        const rootLegal = readFileSync(path.join(root, legalFile), "utf8");
        assert.equal(
          packedLegal,
          rootLegal,
          `${pkgName}: tarball ${legalFile} drifted from repository root ${legalFile}`
        );
      }
    });
  }

  await check("external-unpacked-esm-smoke", () => {
    const consumerDir = path.join(tempDir, "consumer");
    const scopeDir = path.join(consumerDir, "node_modules", "@de-novo");
    mkdirSync(scopeDir, { recursive: true });

    const unpackTargets = [
      ["@de-novo/canvas-core", "canvas-core"],
      ["@de-novo/canvas-editor", "canvas-editor"],
      ["@de-novo/canvas-web", "canvas-web"],
      ["@de-novo/canvas", "canvas"]
    ];
    for (const [pkgName, folder] of unpackTargets) {
      const info = packed.get(pkgName);
      assert.ok(info, `${pkgName} tarball must be packed`);
      const stage = path.join(tempDir, "stage", folder);
      mkdirSync(stage, { recursive: true });
      execFileSync("tar", ["-xzf", info.tgzPath, "-C", stage]);
      execFileSync("mv", [path.join(stage, "package"), path.join(scopeDir, folder)]);
    }

    // Link every declared non-workspace runtime dependency from the workspace's
    // already-installed node_modules so this check runs offline AND catches any
    // undeclared runtime import inside the packed tarballs.
    for (const [pkgName, folder] of unpackTargets) {
      const info = packed.get(pkgName);
      const manifest = JSON.parse(
        readFileSync(path.join(scopeDir, folder, "package.json"), "utf8")
      );
      for (const depName of Object.keys(manifest.dependencies ?? {})) {
        if (depName.startsWith("@de-novo/")) continue;
        const targetLink = path.join(consumerDir, "node_modules", depName);
        if (existsSync(targetLink)) continue;
        const sourceDir = path.join(info.dir, "node_modules", depName);
        assert.ok(
          existsSync(sourceDir),
          `expected declared dependency ${depName} at ${sourceDir}`
        );
        mkdirSync(path.dirname(targetLink), { recursive: true });
        symlinkSync(sourceDir, targetLink);
      }
    }

    writeFileSync(
      path.join(consumerDir, "package.json"),
      JSON.stringify({ name: "pack-smoke-consumer", private: true, type: "module" })
    );
    writeFileSync(
      path.join(consumerDir, "smoke.mjs"),
      `import assert from "node:assert/strict";
import {
  createEditor,
  defineDocument,
  setNodeVisible,
  shallowEqual,
  subscribeCanvasSelector
} from "@de-novo/canvas/2d";

const doc = defineDocument({
  id: "pack-smoke-doc",
  scene: {
    id: "pack-smoke-scene",
    mode: "2d",
    layers: [{ id: "board", name: "Board" }],
    nodes: [
      {
        id: "r1",
        type: "rect",
        layerId: "board",
        position: [10, 20],
        size: [100, 60],
        fill: "#22c55e"
      }
    ]
  }
});
const editor = createEditor({ document: doc });
let undoCalls = 0;
const stop = subscribeCanvasSelector(
  editor,
  (s) => ({ canUndo: s.history.canUndo, undoDepth: s.history.undoDepth }),
  () => { undoCalls += 1; },
  { equals: shallowEqual }
);
await editor.hoverFromHit({ kind: "node", nodeId: "r1", point: [20, 30], renderer: "canvas2d" });
await editor.hoverFromHit({ kind: "empty", point: [0, 0], renderer: "canvas2d" });
assert.equal(undoCalls, 0, "hover churn must not notify history selector");
await editor.apply([setNodeVisible({ nodeId: "r1", visible: false })]);
assert.equal(undoCalls, 1, "document edit must notify history selector once");
assert.equal(editor.getState().history.canUndo, true);
stop();
`
    );

    execFileSync(process.execPath, [path.join(consumerDir, "smoke.mjs")], {
      cwd: consumerDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });

    // Verify @de-novo/canvas packed tarball contains styles.css and Three.js-free 2d.js.
    const stylesCss = readFileSync(
      path.join(scopeDir, "canvas", "src", "styles.css"),
      "utf8"
    );
    assert.ok(
      stylesCss.includes("--dc-"),
      "packed @de-novo/canvas/styles.css must expose --dc-* CSS custom properties"
    );
    const facade2dJs = readFileSync(
      path.join(scopeDir, "canvas", "dist", "2d.js"),
      "utf8"
    );
    assert.ok(
      !facade2dJs.includes("\"three\"") && !facade2dJs.includes("\"@de-novo/canvas-web\""),
      "packed @de-novo/canvas/2d must remain free of Three.js and root @de-novo/canvas-web"
    );
  });
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}

report({ packedPackages: packed.size });
