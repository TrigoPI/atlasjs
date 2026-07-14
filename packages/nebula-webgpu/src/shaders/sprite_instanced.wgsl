struct Instance {
  model: mat4x4<f32>,
  uvRect: vec4<f32>,
  tint: vec4<f32>,
};

@group(1) @binding(0)
var<storage, read> instances: array<Instance>;

@group(2) @binding(0)
var uTexture: texture_2d<f32>;

@group(2) @binding(1)
var uSampler: sampler;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) tint: vec4<f32>,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  var positions = array<vec2<f32>, 6>(
    vec2<f32>(-0.5,  0.5),
    vec2<f32>( 0.5,  0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>( 0.5,  0.5),
    vec2<f32>( 0.5, -0.5),
  );

  var uvs = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(1.0, 1.0),
  );

  let instance = instances[instanceIndex];
  let corner = positions[vertexIndex];
  let localUv = uvs[vertexIndex];

  var out: VertexOutput;
  out.uv = instance.uvRect.xy + localUv * instance.uvRect.zw;
  out.tint = instance.tint;
  out.position =
    uGlobal.viewProjection * instance.model * vec4<f32>(corner, 0.0, 1.0);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  return textureSample(uTexture, uSampler, in.uv) * in.tint;
}
