import DinoBlueImage from "../assets/dino_blue.png";
import SwordImage from "../assets/Iicon_32_01.png";
import SeaLionImage from "../assets/sealion.png";

import {
  type Texture2D,
  type Renderer,
  type Sampler,
  Sprite,
  SpriteSheet,
  SpriteAnimation,
  AnimationPlayer,
  NebulaRenderer,
} from "@atlasjs/nebula";
import { WebGPURenderer } from "@atlasjs/nebula-webgpu";

declare global {
  var animator: AnimationPlayer;
}

function getCanvas(): HTMLCanvasElement {
  const canvas: HTMLCanvasElement | null = document.getElementById(
    "webgpu-canvas",
  ) as HTMLCanvasElement;

  if (!canvas) {
    throw new Error("Canvas element not found.");
  }

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
  const sword: ImageBitmap = await getImage(SwordImage);
  const sealion: ImageBitmap = await getImage(SeaLionImage);

  const canvas: HTMLCanvasElement = getCanvas();
  const renderer: Renderer = new WebGPURenderer(canvas);
  const nebula: NebulaRenderer = new NebulaRenderer(renderer);

  await nebula.init();

  const sampler: Sampler = nebula.createSampler({
    minFilter: "nearest",
    magFilter: "nearest",
  });

  const dinoTexture: Texture2D = nebula.createTexture2D({
    source: dino,
    width: dino.width,
    height: dino.height,
    format: "rgba8unorm",
  });

  const swordTexture: Texture2D = nebula.createTexture2D({
    source: sword,
    width: sword.width,
    height: sword.height,
    format: "rgba8unorm",
  });

  const sealionTexture: Texture2D = nebula.createTexture2D({
    source: sealion,
    width: sealion.width,
    height: sealion.height,
    format: "rgba8unorm",
  });

  const dinoSprite: Sprite = new Sprite(dinoTexture, sampler);
  const swordSprite: Sprite = new Sprite(swordTexture, sampler);
  const sealionSprite: Sprite = new Sprite(sealionTexture);

  const spriteSheet: SpriteSheet = SpriteSheet.fromAutoGrid({
    name: "dino_blue",
    texture: dinoTexture,
    columns: 24,
    rows: 1,
  });

  const runAnimation: SpriteAnimation = new SpriteAnimation({
    fps: 11,
    loop: true,
    autoPlay: true,
    frames: spriteSheet.getManyInRange("dino_blue_", 4, 9),
  });

  const idleAnimation: SpriteAnimation = new SpriteAnimation({
    fps: 8,
    loop: true,
    autoPlay: true,
    frames: spriteSheet.getManyInRange("dino_blue_", 0, 3),
  });

  const animator: AnimationPlayer = new AnimationPlayer();

  // debug
  globalThis.animator = animator;

  animator
    .add("run", runAnimation)
    .add("idle", idleAnimation)
    .setDefault("idle");

  swordSprite.setScale(0.7, 0.7).setZIndex(-1);

  dinoSprite
    .setScale(3, 3)
    .setPosition(100, 100)
    .setAnchor(0.5, 0.5)
    .setRotation(0);

  sealionSprite.setScale(0.3, 0.3).setPosition(200, 200);

  nebula.scene.addChild(sealionSprite);
  // nebula.scene.addChild(dinoSprite);
  // dinoSprite.addChild(swordSprite);

  setInterval(() => {
    // dinoSprite.transform.position.x += 0.1;
    // dinoSprite.transform.rotation += 0.01;
    // animator.updateAndApply(dinoSprite);

    nebula.render();
  }, 1000 / 60);

  document.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.code === "KeyQ") {
      animator.play("idle");
    }

    if (event.code === "KeyW") {
      animator.play("run");
    }
  });
})();
