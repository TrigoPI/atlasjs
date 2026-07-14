struct Instance {
  model: mat4x4<f32>,
  color: vec4<f32>,
  params: vec4<f32>,
};

@group(1) @binding(0)
var<storage, read> instances: array<Instance>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) localPos: vec2<f32>,
  @location(1) color: vec4<f32>,
  @location(2) params: vec4<f32>,
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

  let instance = instances[instanceIndex];
  let corner = positions[vertexIndex];

  var out: VertexOutput;
  out.localPos = corner;
  out.color = instance.color;
  out.params = instance.params;
  out.position =
    uGlobal.viewProjection * instance.model * vec4<f32>(corner, 0.0, 1.0);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  var alpha: f32 = in.color.a;

  if (in.params.x > 0.5) {
    let dist: f32 = length(in.localPos);
    let edge: f32 = fwidth(dist);
    let coverage: f32 = 1.0 - smoothstep(0.5 - edge, 0.5, dist);
    alpha = alpha * coverage;
  }

  return vec4<f32>(in.color.rgb, alpha);
}
