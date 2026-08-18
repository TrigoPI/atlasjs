import DinoBlueImage from "../assets/dino_blue.png";
import SwordImage from "../assets/Iicon_32_01.png";
import SeaLionImage from "../assets/sealion.png";
import { WebGPURenderer } from "@atlasjs/nebula-webgpu";

import {
  type Texture2D,
  type Renderer,
  type Sampler,
  SpriteNode,
  RectNode,
  CircleNode,
  LineNode,
  SpriteSheet,
  SpriteAnimation,
  AnimationPlayer,
  NebulaRenderer,
} from "@atlasjs/nebula";

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

  const dinoSprite: SpriteNode = new SpriteNode(dinoTexture, sampler);
  const swordSprite: SpriteNode = new SpriteNode(swordTexture, sampler);
  const sealionSprite: SpriteNode = new SpriteNode(sealionTexture);

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

  swordSprite.setScale(0.7, 0.7).setSortPrimary(-1);

  dinoSprite
    .setScale(3, 3)
    .setPosition(100, 100)
    .setAnchor(0.5, 0.5)
    .setRotation(0);

  sealionSprite.setScale(0.3, 0.3).setPosition(200, 200);

  nebula.scene.addChild(sealionSprite);
  // nebula.scene.addChild(dinoSprite);
  // dinoSprite.addChild(swordSprite);

  const bgRect: RectNode = new RectNode(320, 240);
  bgRect.setColor(0.15, 0.2, 0.55, 1).setPosition(200, 200).setSortPrimary(-1);

  const circle: CircleNode = new CircleNode(70);
  circle.setColor(0.9, 0.3, 0.3, 1).setPosition(330, 130).setSortPrimary(1);

  const line: LineNode = new LineNode(80, 320, 360, 250, 1);
  line.setColor(0.2, 0.9, 0.4, 1).setSortPrimary(2);

  nebula.scene.addChild(bgRect);
  nebula.scene.addChild(circle);
  nebula.scene.addChild(line);

  const filledRect: RectNode = new RectNode(80, 80);
  filledRect.setPosition(120, 420).setColor(1, 1, 1, 1);

  const strokedRect: RectNode = new RectNode(80, 80);
  strokedRect.setPosition(260, 420).setColor(0, 1, 0, 1).setBorderWidth(3);

  const wideStrokedRect: RectNode = new RectNode(160, 60);
  wideStrokedRect.setPosition(460, 420).setColor(1, 1, 0, 1).setBorderWidth(3);

  const filledCircle: CircleNode = new CircleNode(40);
  filledCircle.setPosition(640, 420).setColor(1, 1, 1, 1);

  const ring: CircleNode = new CircleNode(40);
  ring.setPosition(760, 420).setColor(0, 1, 1, 1).setBorderWidth(3);

  nebula.scene.addChild(filledRect);
  nebula.scene.addChild(strokedRect);
  nebula.scene.addChild(wideStrokedRect);
  nebula.scene.addChild(filledCircle);
  nebula.scene.addChild(ring);

  setInterval(() => {
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
