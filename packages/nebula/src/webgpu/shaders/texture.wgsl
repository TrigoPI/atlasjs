struct VertexInput {
  @location(0) position: vec2<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@group(1) @binding(0)
var atlasTexture: texture_2d<f32>;

@group(1) @binding(1)
var atlasSampler: sampler;

@group(2) @binding(0)
var<uniform> modelMatrix: mat4x4<f32>;

@group(2) @binding(1)
var<uniform> sourceRect: vec4<f32>;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  
  out.position = viewProjection * modelMatrix * vec4<f32>(input.position, 0.0, 1.0);
  out.uv = sourceRect.xy + input.uv * sourceRect.zw;

  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  return textureSample(atlasTexture, atlasSampler, in.uv);
}