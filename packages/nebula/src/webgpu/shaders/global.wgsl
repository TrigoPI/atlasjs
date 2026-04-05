struct AtlasGlobal {
    viewProjection: mat4x4<f32>,
    time: f32,
}

@group(0) @binding(0)
var<uniform> uGlobal: AtlasGlobal;