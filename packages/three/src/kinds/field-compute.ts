/**
 * WebGPU compute for `plugin.denovo.field` streak travel. The document stays
 * the same; only the tick moves from a CPU loop to a compute dispatch.
 * Positions stay on the GPU and copy into Three's vertex buffer (Reference
 * mode). The hot path does not MAP_READ.
 */
const GPU_BUFFER_USAGE_COPY_SRC = 0x0004;
const GPU_BUFFER_USAGE_COPY_DST = 0x0008;
const GPU_BUFFER_USAGE_STORAGE = 0x0080;
const GPU_BUFFER_USAGE_UNIFORM = 0x0040;
const GPU_SHADER_STAGE_COMPUTE = 0x4;
const WORKGROUP_SIZE = 64;
const SEED_FLOATS = 8;
const POSITION_FLOATS = 6;

const STREAK_COMPUTE_SHADER = /* wgsl */ `
struct Seed {
  x: f32,
  y: f32,
  z: f32,
  length: f32,
  phase: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
}

struct Params {
  travel: f32,
  corridorFar: f32,
  corridorSpan: f32,
  count: u32,
}

@group(0) @binding(0) var<storage, read> seeds: array<Seed>;
@group(0) @binding(1) var<storage, read_write> positions: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;

fn wrap_corridor(value: f32) -> f32 {
  var wrapped = ((value - params.corridorFar) % params.corridorSpan) + params.corridorFar;
  if (wrapped < params.corridorFar) {
    wrapped += params.corridorSpan;
  }
  return wrapped;
}

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;
  if (index >= params.count) {
    return;
  }
  let seed = seeds[index];
  let z = wrap_corridor(seed.z + params.travel + seed.phase * params.corridorSpan);
  let offset = index * ${POSITION_FLOATS}u;
  positions[offset] = seed.x;
  positions[offset + 1u] = seed.y;
  positions[offset + 2u] = z;
  positions[offset + 3u] = seed.x;
  positions[offset + 4u] = seed.y;
  positions[offset + 5u] = z + seed.length;
}
`;

export type DenovoFieldStreakSeed = {
  readonly length: number;
  readonly phase: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

export type DenovoFieldStreakCompute = {
  readonly device: GPUDevice;
  readonly dispatches: number;
  readonly residentCopies: number;
  destroy(): void;
  tick(
    elapsedMs: number,
    speed: number,
    corridorFar: number,
    corridorSpan: number,
    destination: GPUBuffer
  ): boolean;
};

export function createDenovoFieldStreakCompute(
  device: GPUDevice,
  seeds: readonly DenovoFieldStreakSeed[]
): DenovoFieldStreakCompute {
  const count = seeds.length;
  const seedData = new Float32Array(count * SEED_FLOATS);
  for (let index = 0; index < count; index += 1) {
    const seed = seeds[index]!;
    const offset = index * SEED_FLOATS;
    seedData[offset] = seed.x;
    seedData[offset + 1] = seed.y;
    seedData[offset + 2] = seed.z;
    seedData[offset + 3] = seed.length;
    seedData[offset + 4] = seed.phase;
  }

  const seedBuffer = device.createBuffer({
    size: seedData.byteLength,
    usage: GPU_BUFFER_USAGE_STORAGE | GPU_BUFFER_USAGE_COPY_DST
  });
  device.queue.writeBuffer(seedBuffer, 0, seedData);

  const positionBytes = count * POSITION_FLOATS * 4;
  const positionBuffer = device.createBuffer({
    size: positionBytes,
    usage: GPU_BUFFER_USAGE_STORAGE | GPU_BUFFER_USAGE_COPY_SRC
  });
  const paramBuffer = device.createBuffer({
    size: 16,
    usage: GPU_BUFFER_USAGE_UNIFORM | GPU_BUFFER_USAGE_COPY_DST
  });

  const shader = device.createShaderModule({ code: STREAK_COMPUTE_SHADER });
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPU_SHADER_STAGE_COMPUTE,
        buffer: { type: "read-only-storage" }
      },
      {
        binding: 1,
        visibility: GPU_SHADER_STAGE_COMPUTE,
        buffer: { type: "storage" }
      },
      {
        binding: 2,
        visibility: GPU_SHADER_STAGE_COMPUTE,
        buffer: { type: "uniform" }
      }
    ]
  });
  const pipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    compute: { module: shader, entryPoint: "main" }
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: seedBuffer } },
      { binding: 1, resource: { buffer: positionBuffer } },
      { binding: 2, resource: { buffer: paramBuffer } }
    ]
  });

  let dispatches = 0;
  let residentCopies = 0;
  let destroyed = false;

  function destroy() {
    if (destroyed) {
      return;
    }
    destroyed = true;
    seedBuffer.destroy();
    positionBuffer.destroy();
    paramBuffer.destroy();
  }

  function tick(
    elapsedMs: number,
    speed: number,
    corridorFar: number,
    corridorSpan: number,
    destination: GPUBuffer
  ): boolean {
    if (destroyed || count === 0 || destination.size < positionBytes) {
      return false;
    }

    const travel = (elapsedMs / 1000) * (speed / 40) * 22;
    const params = new ArrayBuffer(16);
    const floats = new Float32Array(params);
    const uints = new Uint32Array(params);
    floats[0] = travel;
    floats[1] = corridorFar;
    floats[2] = corridorSpan;
    uints[3] = count;
    device.queue.writeBuffer(paramBuffer, 0, params);

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(count / WORKGROUP_SIZE));
    pass.end();
    encoder.copyBufferToBuffer(positionBuffer, 0, destination, 0, positionBytes);
    device.queue.submit([encoder.finish()]);
    dispatches += 1;
    residentCopies += 1;
    return true;
  }

  return {
    get device() {
      return device;
    },
    get dispatches() {
      return dispatches;
    },
    get residentCopies() {
      return residentCopies;
    },
    destroy,
    tick
  };
}
