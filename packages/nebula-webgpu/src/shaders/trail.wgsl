struct Segment {
  posA: vec2<f32>,
  posB: vec2<f32>,
  edgeA: vec2<f32>,
  edgeB: vec2<f32>,
  colorA: vec4<f32>,
  colorB: vec4<f32>,
};

@group(1) @binding(0)
var<storage, read> segments: array<Segment>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) side: f32,
};

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(0.0, -1.0),
    vec2<f32>(0.0,  1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(0.0,  1.0),
    vec2<f32>(1.0,  1.0),
  );

  let segment = segments[instanceIndex];
  let corner = corners[vertexIndex];
  let far: bool = corner.x > 0.5;

  let base: vec2<f32> = select(segment.posA, segment.posB, far);
  let edge: vec2<f32> = select(segment.edgeA, segment.edgeB, far);
  let color: vec4<f32> = select(segment.colorA, segment.colorB, far);

  var out: VertexOutput;
  out.position = uGlobal.viewProjection * vec4<f32>(base + edge * corner.y, 0.0, 1.0);
  out.color = color;
  out.side = corner.y;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let aa: f32 = max(fwidth(in.side), 1e-5);
  let coverage: f32 = clamp((1.0 - abs(in.side)) / aa, 0.0, 1.0);
  return vec4<f32>(in.color.rgb, in.color.a * coverage);
}
