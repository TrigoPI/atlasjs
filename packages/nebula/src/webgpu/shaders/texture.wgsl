struct VertexInput {
  @location(0) position: vec2<f32>,
  @location(1) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

struct ObjectUniforms {
  model: mat4x4<f32>,
  sourceRect: vec4<f32>,
};

@group(1) @binding(0)
var<uniform> uObject: ObjectUniforms;

@group(2) @binding(1)
var uTexture: texture_2d<f32>;

@group(2) @binding(2)
var uSampler: sampler;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  
  out.uv = 
    uObject.sourceRect.xy + 
    input.uv * 
    uObject.sourceRect.zw;

  out.position = 
    uGlobal.viewProjection * 
    uObject.model * 
    vec4<f32>(input.position, 0.0, 1.0);

  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  return textureSample(uTexture, uSampler, in.uv);
}