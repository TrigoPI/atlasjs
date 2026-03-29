import DinoBlueImage from "../assets/dino_blue.png";

import {
  type Texture2D,
  type Renderer,
  WebGPURenderer,
  SpriteRenderer,
  Sprite,
  type Sampler,
} from "@atlasjs/nebula";

function getCanvas(): HTMLCanvasElement {
  const canvas: HTMLCanvasElement | null = document.getElementById(
    "webgpu-canvas",
  ) as HTMLCanvasElement;

  if (!canvas) {
    throw new Error("Canvas element not found.");
  }

  return canvas;
}

async function getImage(): Promise<ImageBitmap> {
  const image: HTMLImageElement = new Image();
  image.src = DinoBlueImage;
  await image.decode();
  return createImageBitmap(image, {
    imageOrientation: "flipY",
  });
}

(async () => {
  const image: ImageBitmap = await getImage();
  const canvas: HTMLCanvasElement = getCanvas();
  const renderer: Renderer = new WebGPURenderer(canvas);

  await renderer.init();

  const spriteRenderer: SpriteRenderer = new SpriteRenderer(renderer);

  const sampler: Sampler = renderer.createSampler({
    minFilter: "nearest",
    magFilter: "nearest",
  });

  const texture: Texture2D = renderer.createTexture2D({
    width: image.width,
    height: image.height,
    source: image,
    format: "rgba8unorm",
  });

  const sprite: Sprite = new Sprite(texture, sampler);
  const cellSize: number = texture.width / 24;
  const cellHeight: number = texture.height;

  sprite
    .setScale(64, 64)
    .setPosition(100, 100)
    .setAnchor(0.5, 0.5)
    .setRotation(0)
    .setSourceRect(0, 0, cellSize, cellHeight);

  // setInterval(() => {
  sprite.transform.rotation += 0.01;

  renderer.beginFrame();
  // shapeRenderer.drawRect(rect1);
  // shapeRenderer.drawRect(rect2);
  spriteRenderer.drawSprite(sprite);
  renderer.endFrame();
  // }, 1000 / 60);
})();
