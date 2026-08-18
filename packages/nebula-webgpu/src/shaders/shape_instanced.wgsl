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
  @location(3) halfSize: vec2<f32>,
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

  let sx: f32 = length(instance.model[0].xyz);
  let sy: f32 = length(instance.model[1].xyz);

  var out: VertexOutput;
  out.localPos = corner;
  out.color = instance.color;
  out.params = instance.params;
  out.halfSize = vec2<f32>(sx, sy) * 0.5;
  out.position =
    uGlobal.viewProjection * instance.model * vec4<f32>(corner, 0.0, 1.0);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let isCircle: bool = in.params.x > 0.5;
  let border: f32 = in.params.y;

  let p: vec2<f32> = in.localPos * in.halfSize * 2.0;

  let circleDist: f32 = length(p) - in.halfSize.x;
  let q: vec2<f32> = abs(p) - in.halfSize;
  let rectDist: f32 = length(max(q, vec2<f32>(0.0))) + min(max(q.x, q.y), 0.0);
  let d: f32 = select(rectDist, circleDist, isCircle);

  let aa: f32 = max(fwidth(d), 1e-5);
  let outer: f32 = 1.0 - smoothstep(-aa, 0.0, d);
  let inner: f32 = smoothstep(-aa, 0.0, d + border);
  let stroked: f32 = select(outer, outer * inner, border > 0.0);
  let coverage: f32 = select(stroked, 1.0, !isCircle && border <= 0.0);

  return vec4<f32>(in.color.rgb, in.color.a * coverage);
}
