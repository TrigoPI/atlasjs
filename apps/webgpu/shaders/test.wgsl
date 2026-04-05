struct AltlasGlobal {
  viewProjection: mat4x4<f32>,
  time: f32,
};

struct MaterialUniforms {
  baseColor: vec4<f32>,
};

struct ObjectUniforms {
  model: mat4x4<f32>,
};

struct VertexIn {
  @location(0) position: vec2<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@group(0) @binding(0)
var<uniform> uGlobal: AltlasGlobal;

@group(1) @binding(0)
var<uniform> uObject: ObjectUniforms;

@group(2) @binding(0)
var<uniform> uMaterial: MaterialUniforms;

@group(2) @binding(1)
var uTexture: texture_2d<f32>;

@group(2) @binding(2)
var uSampler: sampler;

@vertex
fn vs_main(input: VertexIn) -> VertexOut {
  var out: VertexOut;
  out.position = uGlobal.viewProjection * uObject.model * vec4<f32>(input.position, 0.0, 1.0);
  out.uv = input.uv;
  return out;
}

@fragment
fn fs_main(input: VertexOut) -> @location(0) vec4<f32> {
  return textureSample(uTexture, uSampler, input.uv);
}