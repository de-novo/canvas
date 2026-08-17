<script setup lang="ts">
import {
  type Canvas2DSceneInput,
  type Canvas3DSceneInput
} from "@denovo/canvas-core";
import { DenovoCanvas } from "@denovo/vue-canvas";
import { computed, ref } from "vue";

type DemoMode = "2d" | "3d";

const mode = ref<DemoMode>("3d");

const scene = computed(() =>
  mode.value === "3d" ? createThreeScene() : createTwoScene()
);

function swapScene() {
  mode.value = mode.value === "3d" ? "2d" : "3d";
}

function createThreeScene(): Canvas3DSceneInput {
  return {
    id: "vue-three",
    mode: "3d",
    layers: [{ id: "main", name: "Main" }],
    background: "#0f172a",
    render: {
      loop: "demand",
      dpr: 1.5,
      frustumCulling: true,
      batch: false
    },
    camera: {
      position: [5, 3.5, 7],
      target: [0, 0, 0],
      fov: 44
    },
    nodes: [
      {
        id: "primary",
        layerId: "main",
        type: "sphere",
        color: "#38bdf8",
        position: [0, 0.4, 0],
        radius: 0.9
      }
    ]
  };
}

function createTwoScene(): Canvas2DSceneInput {
  return {
    id: "vue-two",
    mode: "2d",
    layers: [{ id: "main", name: "Main" }],
    background: "#111827",
    render: {
      loop: "demand",
      dpr: 1.5,
      frustumCulling: true,
      batch: false
    },
    nodes: [
      {
        id: "panel",
        layerId: "main",
        type: "rect",
        fill: "#22c55e",
        position: [96, 96],
        size: [260, 180],
        rotation: 0.08
      },
      {
        id: "badge",
        layerId: "main",
        type: "circle",
        fill: "#38bdf8",
        position: [420, 220],
        radius: 76
      }
    ]
  };
}
</script>

<template>
  <main class="shell">
    <section class="viewport">
      <DenovoCanvas
        class="stage"
        :scene="scene"
      />
    </section>
    <aside class="panel">
      <p class="eyebrow">Vue</p>
      <h1>Vue adapter smoke example</h1>
      <p>
        Renders 2D and 3D scenes through <code>@denovo/vue-canvas</code>.
      </p>
      <div class="controls">
        <button
          type="button"
          data-denovo-control="swap"
          @click="swapScene"
        >
          Swap scene
        </button>
      </div>
      <p class="mode-readout">
        Mode: <output id="mode-readout">{{ mode }}</output>
      </p>
    </aside>
  </main>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: 1fr;
  min-height: 100svh;
}

@media (min-width: 900px) {
  .shell {
    grid-template-columns: minmax(0, 1fr) 22rem;
  }
}

.viewport {
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  padding: 1rem;
  min-height: 50svh;
}

@media (min-width: 900px) {
  .viewport {
    min-height: 100svh;
  }
}

.stage {
  flex: 1;
  min-height: 320px;
  border-radius: 12px;
  overflow: hidden;
  background: #0f172a;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
  border-top: 1px solid #1e293b;
  background: #0f172a;
}

@media (min-width: 900px) {
  .panel {
    border-top: none;
    border-left: 1px solid #1e293b;
  }
}

.eyebrow {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #94a3b8;
}

h1 {
  margin: 0.75rem 0 0;
  font-size: 1.5rem;
  font-weight: 600;
}

code {
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  background: #1e293b;
  font-size: 0.85em;
}

.controls button {
  padding: 0.5rem 1rem;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #1e293b;
  color: #e2e8f0;
  font: inherit;
  cursor: pointer;
}

.controls button:hover {
  background: #334155;
}

.mode-readout {
  margin: 0;
  font-size: 0.875rem;
  color: #94a3b8;
}

#mode-readout {
  color: #38bdf8;
  font-weight: 600;
}
</style>
