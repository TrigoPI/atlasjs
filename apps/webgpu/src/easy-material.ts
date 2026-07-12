import DinoBlueImage from "../assets/dino_blue.png";

import { Mat4, Vec4 } from "@atlasjs/math";
import {
  type Texture2D,
  type Sampler,
  type Geometry,
  type Pipeline,
  type Material,
  type BindingGroup,
  type ShaderDescriptor,
} from "@atlasjs/nebula";
import { WebGPURenderer, defineMaterial } from "@atlasjs/nebula-webgpu";

// Easy-path material: only a `material { }` block + a @fragment function.
// No @group / @binding, no vertex stage, no IO structs — all injected.
const MATERIAL_SOURCE = `
material {
  tint: vec4<f32>,
  uTexture: texture_2d<f32>,
  uSampler: sampler,
}

@fragment
fn fs_main(in: FragmentInput) -> @location(0) vec4<f32> {
  let base = textureSample(uTexture, uSampler, in.uv);
  return base * material.tint;
}
`;

function getCanvas(): HTMLCanvasElement {
  const canvas = document.getElementById("webgpu-canvas") as HTMLCanvasElement;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  return canvas;
}

async function getImage(src: string): Promise<ImageBitmap> {
  const image = new Image();
  image.src = src;
  await image.decode();
  return createImageBitmap(image, { imageOrientation: "flipY" });
}

(async () => {
  const dino: ImageBitmap = await getImage(DinoBlueImage);

  const canvas: HTMLCanvasElement = getCanvas();
  const renderer: WebGPURenderer = new WebGPURenderer(canvas);
  await renderer.init();

  const geometry: Geometry = renderer.createQuad();
  const shaderDescriptor: ShaderDescriptor = defineMaterial(MATERIAL_SOURCE);
  const shader = renderer.createShader(shaderDescriptor);
  const pipeline: Pipeline = renderer.createPipeline(shader, geometry);

  const texture: Texture2D = renderer.createTexture2D({
    source: dino,
    width: dino.width,
    height: dino.height,
    format: "rgba8unorm",
  });

  const sampler: Sampler = renderer.createSampler({
    minFilter: "nearest",
    magFilter: "nearest",
  });

  const material: Material = renderer
    .createMaterial(shader)
    .set("tint", new Vec4(1.0, 0.4, 0.4, 1.0))
    .set("uTexture", texture)
    .set("uSampler", sampler);

  const model: Mat4 = Mat4.identity()
    .translate(canvas.width / 2, canvas.height / 2, 0)
    .scale(400, 400);

  const objectBindings: BindingGroup = renderer
    .createBindingGroup(shader.objectDefinition)
    .set("model", model);

  renderer.beginFrame();
  renderer.draw(geometry, pipeline, material, objectBindings);
  renderer.endFrame();
})();
