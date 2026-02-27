import { NebulaRenderer, RectNode } from "@atlasjs/nebula";
import { PixiRenderer, PixiTextureResolver } from "@atlasjs/pixi";

(async () => {
  const canvas: HTMLElement | null = document.getElementById("canvas");
  const textureResolver: PixiTextureResolver = new PixiTextureResolver();
  const renderer: PixiRenderer = new PixiRenderer({
    canvas: canvas as HTMLCanvasElement,
    textureResolver: textureResolver,
    width: window.innerWidth,
    height: window.innerHeight,
  });

  await renderer.init();

  const nebula: NebulaRenderer = new NebulaRenderer(renderer);
  const rect: RectNode = nebula
    .createRect()
    .setSize(32, 32)
    .setFillColor(0xff0000);

  nebula.root.add(rect);
  nebula.camera.setViewportSize(window.innerWidth, window.innerHeight);

  setInterval(() => {
    nebula.render();
  }, 1000 / 60);
})();
