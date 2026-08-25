import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createCheckRunner } from "./lib/checks.mjs";

const { check, report } = createCheckRunner();
const root = path.resolve(import.meta.dirname, "..");

const core = await import(
  pathToFileURL(path.join(root, "packages", "core", "dist", "index.js")).href
);
const three = await import(
  pathToFileURL(path.join(root, "packages", "three", "dist", "index.js")).href
);

const fieldProps = {
  brightness: 1,
  density: 0.6,
  hue: 210,
  pattern: "streaks",
  speed: 15
};

await check("official-field-document-needs-no-host-register", () => {
  const document = core.defineDocument({
    id: "field-drawer",
    scene: {
      id: "field-drawer-scene",
      layers: [{ id: "hero", name: "Hero" }],
      nodes: [
        {
          id: "field",
          layerId: "hero",
          props: fieldProps,
          type: core.DENOVO_FIELD_NODE_TYPE
        }
      ]
    }
  });
  const node = document.scene.nodes[0];
  assert.ok(node && core.isDenovoFieldNode(node));
  assert.equal(node.props.pattern, "streaks");
});

await check("official-field-drawer-reads-density-and-pattern", () => {
  const sparse = three.createDenovoFieldObject({
    ...fieldProps,
    density: 0.1
  });
  const dense = three.createDenovoFieldObject({
    ...fieldProps,
    density: 0.9
  });
  const letters = three.createDenovoFieldObject({
    ...fieldProps,
    pattern: "letters"
  });

  const sparseState = three.readDenovoFieldObjectState(sparse);
  const denseState = three.readDenovoFieldObjectState(dense);
  const letterState = three.readDenovoFieldObjectState(letters);
  assert.equal(sparseState?.count, core.denovoFieldInstanceCount(0.1));
  assert.equal(denseState?.count, core.denovoFieldInstanceCount(0.9));
  assert.ok((denseState?.count ?? 0) > (sparseState?.count ?? 0));
  assert.equal(sparseState?.pattern, "streaks");
  assert.equal(letterState?.pattern, "letters");

  three.tickDenovoFieldObject(sparse, 1000);
  assert.equal(three.isDenovoFieldObject(sparse), true);
});

report();
