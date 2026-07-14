import DinoBlueImage from "../assets/dino_blue.png";

import {
  type Renderer,
  type Texture2D,
  type Sampler,
  Sprite,
  NebulaRenderer,
  Color,
} from "@atlasjs/nebula";
import { WebGPURenderer } from "@atlasjs/nebula-webgpu";

function getCanvas(): HTMLCanvasElement {
  const canvas: HTMLCanvasElement | null = document.getElementById(
    "webgpu-canvas",
  ) as HTMLCanvasElement;

  if (!canvas) {
    throw new Error("Canvas element not found.");
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  return canvas;
}

async function getImage(src: string): Promise<ImageBitmap> {
  const image: HTMLImageElement = new Image();
  image.src = src;
  await image.decode();
  return createImageBitmap(image, {
    imageOrientation: "flipY",
  });
}

(async () => {
  const dino: ImageBitmap = await getImage(DinoBlueImage);

  const canvas: HTMLCanvasElement = getCanvas();
  const renderer: Renderer = new WebGPURenderer(canvas);
  const nebula: NebulaRenderer = new NebulaRenderer(renderer);

  await nebula.init();

  const dinoTexture: Texture2D = renderer.createTexture2D({
    source: dino,
    width: dino.width,
    height: dino.height,
    format: "rgba8unorm",
  });

  const sampler: Sampler = renderer.createSampler({
    magFilter: "nearest",
    minFilter: "nearest",
  });

  const sprite: Sprite = new Sprite(dinoTexture, sampler);

  nebula.scene.addChild(sprite);
  nebula.render();
})();
