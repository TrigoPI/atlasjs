struct VertexInput {
  @location(0) position: vec2<f32>,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
}

@group(1) @binding(0)
var<uniform> color: vec4<f32>;

@group(2) @binding(0)
var<uniform> modelMatrix: mat4x4<f32>;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let local: vec4<f32> = vec4<f32>(input.position, 0.0, 1.0);
  out.position = viewProjection * modelMatrix * local;
  return out;
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
  return color;
}